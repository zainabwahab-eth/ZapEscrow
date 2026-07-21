import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { v4 as uuid } from "uuid";

interface MonnifyAuthResponse {
  responseBody: { accessToken: string; expiresIn: number };
}

interface InitTransactionResponse {
  responseBody: {
    transactionReference: string;
    paymentReference: string;
    checkoutUrl: string;
  };
}

interface SingleTransferResponse {
  responseBody: {
    reference: string;
    status: "SUCCESS" | "PENDING_AUTHORIZATION" | "FAILED";
    amount: number;
  };
}

/**
 * Wraps the Monnify API. Handles auth token caching, transaction
 * initialization (buyer payment into escrow), and single disbursement
 * (releasing funds to the seller).
 *
 * NOTE: Disbursement calls require the OTP waiver to have been applied
 * to the account (see project notes) — otherwise every call will come
 * back PENDING_AUTHORIZATION instead of completing automatically.
 */
@Injectable()
export class MonnifyService {
  private readonly logger = new Logger(MonnifyService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl() {
    return this.config.get<string>("MONNIFY_BASE_URL");
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const apiKey = this.config.get<string>("MONNIFY_API_KEY");
    const secretKey = this.config.get<string>("MONNIFY_SECRET_KEY");
    const encoded = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

    const { data } = await firstValueFrom(
      this.http.post<MonnifyAuthResponse>(
        `${this.baseUrl}/api/v1/auth/login`,
        {},
        { headers: { Authorization: `Basic ${encoded}` } },
      ),
    );

    this.cachedToken = data.responseBody.accessToken;
    // Refresh a little early — token is valid ~1hr
    this.tokenExpiresAt =
      Date.now() + (data.responseBody.expiresIn - 60) * 1000;
    return this.cachedToken;
  }

  /**
   * Starts a payment for a deal. Generates a unique paymentReference —
   * NEVER reuse a reference across deals/attempts, Monnify will reject it.
   */
  async initializeTransaction(params: {
    amount: number;
    buyerEmail: string;
    buyerName: string;
    dealId: string;
  }): Promise<{
    paymentReference: string;
    transactionReference: string;
    checkoutUrl: string;
  }> {
    const token = await this.getAccessToken();
    const paymentReference = `deal-${params.dealId}-${uuid().slice(0, 8)}`;

    const { data } = await firstValueFrom(
      this.http.post<InitTransactionResponse>(
        `${this.baseUrl}/api/v1/merchant/transactions/init-transaction`,
        {
          amount: params.amount,
          customerName: params.buyerName || "Buyer",
          customerEmail: params.buyerEmail || "buyer@example.com",
          paymentReference,
          paymentDescription: `Escrow payment for deal ${params.dealId}`,
          currencyCode: "NGN",
          contractCode: this.config.get<string>("MONNIFY_CONTRACT_CODE"),
          redirectUrl: `${this.config.get<string>("PUBLIC_FRONTEND_URL")}/pay/${params.dealId}/complete`,
          paymentMethods: ["ACCOUNT_TRANSFER", "CARD", "USSD"],
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    return {
      paymentReference: data.responseBody.paymentReference,
      transactionReference: data.responseBody.transactionReference,
      checkoutUrl: data.responseBody.checkoutUrl,
    };
  }

  /** Confirms payment status server-side — never trust redirect params alone. */
  async getTransactionStatus(transactionReference: string) {
    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.get(
        `${this.baseUrl}/api/v2/transactions/${transactionReference}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
    return data;
  }

  /** Full list of supported banks, for populating a real dropdown instead of a hardcoded list. */
  async getBanks(): Promise<{ name: string; code: string; logo?: string }[]> {
    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.get<{ responseBody: any[] }>(`${this.baseUrl}/api/v1/banks`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return (data.responseBody ?? []).map((bank) => ({
      name: bank.name ?? bank.bankName,
      code: bank.code ?? bank.bankCode,
      ...(bank.logo ? { logo: bank.logo } : {}),
    }));
  }

  /** Look up an account name before disbursing — required to avoid failed transfers. */
  async nameEnquiry(accountNumber: string, bankCode: string) {
    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.get(
        `${this.baseUrl}/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
    return data;
  }

  /**
   * Releases escrowed funds to the seller. One call per deal — this is
   * the Single Disbursement API, which is all this project needs (see
   * project notes on why Bulk isn't the right fit here).
   */
  async releaseSingleTransfer(params: {
    amount: number;
    destinationAccountNumber: string;
    destinationBankCode: string;
    destinationAccountName: string;
    dealId: string;
  }): Promise<SingleTransferResponse["responseBody"]> {
    const token = await this.getAccessToken();
    const reference = `release-${params.dealId}-${uuid().slice(0, 8)}`;

    try {
      const { data } = await firstValueFrom(
        this.http.post<SingleTransferResponse>(
          `${this.baseUrl}/api/v2/disbursements/single`,
          {
            amount: params.amount,
            reference,
            narration: `Escrow release for deal ${params.dealId}`,
            destinationBankCode: params.destinationBankCode,
            destinationAccountNumber: params.destinationAccountNumber,
            destinationAccountName: params.destinationAccountName,
            currency: "NGN",
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      if (data.responseBody.status === "PENDING_AUTHORIZATION") {
        // This means the OTP waiver hasn't been applied yet — flag loudly,
        // don't let this fail silently since it blocks the whole escrow flow.
        this.logger.error(
          `Disbursement for deal ${params.dealId} is PENDING_AUTHORIZATION — OTP waiver may not be active yet.`,
        );
      }

      return data.responseBody;
    } catch (err) {
      this.logger.error(
        `Monnify disbursement rejected for deal ${params.dealId}: ${JSON.stringify(err.response?.data ?? err.message)}`,
      );
      throw err;
    }
  }
}
