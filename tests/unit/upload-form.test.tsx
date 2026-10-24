import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadForm } from "@/app/portal/deposits/[id]/upload-form.client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// jsdom has no SubtleCrypto: the component hashes files with it, so tests pin
// a deterministic digest instead of depending on the environment.
const FIXED_DIGEST = new Uint8Array(32).fill(7);

function mockSubtleCrypto(): void {
  const cryptoValue = globalThis.crypto ?? {};
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...cryptoValue,
      subtle: {
        ...(cryptoValue as Crypto).subtle,
        digest: vi.fn().mockResolvedValue(FIXED_DIGEST.buffer as ArrayBuffer),
      },
    },
    configurable: true,
  });
}

function mockFetchOnce(response: { ok: boolean; status?: number; json?: unknown }): void {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: () => Promise.resolve(response.json ?? {}),
  } as Response);
}

describe("<UploadForm />", () => {
  beforeEach(() => {
    mockSubtleCrypto();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("hashes, signs, PUTs and refreshes on the happy path", async () => {
    const user = userEvent.setup();
    mockFetchOnce({ ok: true, json: { url: "http://localhost:9090/signed", assetId: "asset-1" } });
    mockFetchOnce({ ok: true });

    render(<UploadForm depositId="deposit-1" />);
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("File"), file);
    // NOTE: user.click() on the submit button does not trigger jsdom form
    // submission in this setup; fireEvent exercises the same onSubmit handler.
    fireEvent.submit(screen.getByRole("button", { name: /upload/i }).closest("form")!);

    expect(await screen.findByText(/stored — integrity scan/i)).toBeInTheDocument();
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(2);
    const [signUrl, signInit] = calls[0];
    expect(signUrl).toBe("/api/uploads/sign");
    expect(JSON.parse((signInit as RequestInit).body as string)).toMatchObject({
      depositId: "deposit-1",
      filename: "hello.txt",
      assetType: "SOURCE",
      sizeBytes: 5,
    });
    expect(calls[1][0]).toBe("http://localhost:9090/signed");
  });

  it("surfaces the server error when signing fails", async () => {
    const user = userEvent.setup();
    mockFetchOnce({ ok: false, status: 409, json: { error: { message: "Deposit is ACTIVE" } } });

    render(<UploadForm depositId="deposit-1" />);
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("File"), file);
    fireEvent.submit(screen.getByRole("button", { name: /upload/i }).closest("form")!);

    expect(await screen.findByText("Deposit is ACTIVE")).toBeInTheDocument();
  });
});
