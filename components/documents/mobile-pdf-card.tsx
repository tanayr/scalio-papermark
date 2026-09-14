import { useRef, useState } from "react";
import { DocumentVersion } from "@prisma/client";
import { Smartphone, Upload, Loader2 } from "lucide-react";
import { mutate } from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function MobilePdfCard({
  version,
  teamId,
}: {
  version: DocumentVersion;
  teamId: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const documentUrl = `/api/teams/${teamId}/documents/${version.documentId}`;
  const url = `${documentUrl}/mobile?versionId=${encodeURIComponent(version.id)}`;
  const ready = !!version.mobileFile && !!version.mobileNumPages;

  async function update(
    method: "POST" | "PATCH" | "DELETE",
    file?: File,
    enabled?: boolean,
  ) {
    if (
      file &&
      (!file.name.toLowerCase().endsWith(".pdf") ||
        file.size > 30 * 1024 * 1024)
    ) {
      toast.error("Choose a PDF up to 30 MB.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(url, {
        method,
        headers: file
          ? {
              "Content-Type": "application/pdf",
              "X-File-Name": encodeURIComponent(file.name),
            }
          : { "Content-Type": "application/json" },
        body:
          file ??
          (method === "PATCH" ? JSON.stringify({ enabled }) : undefined),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(
          error?.message ||
            "Unable to update the mobile PDF. Please try again.",
        );
      }
      await mutate(documentUrl);
      setRemoving(false);
      toast.success(
        method === "POST"
          ? "Mobile PDF ready."
          : method === "DELETE"
            ? "Mobile PDF removed."
            : enabled
              ? "Mobile PDF enabled."
              : "Mobile PDF disabled.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update the mobile PDF.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (version.storageType !== "LOCAL_PATH" || !version.file.endsWith(".pdf"))
    return null;

  return (
    <section
      className="rounded-lg border bg-background p-5"
      aria-labelledby="mobile-pdf-title"
      aria-busy={busy}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id="mobile-pdf-title" className="text-base font-semibold">
              Mobile version
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a portrait PDF to show automatically on phones.
            </p>
            {ready && (
              <p className="mt-2 break-words text-sm">
                {version.mobileName || "Mobile deck.pdf"}{" "}
                <span className="text-muted-foreground">
                  · {version.mobileNumPages} pages
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Upload mobile PDF"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void update("POST", file);
            }}
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {busy ? "Saving…" : ready ? "Replace PDF" : "Upload mobile PDF"}
          </Button>
          {ready && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setRemoving(!removing)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      {busy && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Saving your changes. PDF uploads may take a moment to process.
        </p>
      )}
      {removing && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span>Remove the mobile PDF? Phones will use the desktop deck.</span>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void update("DELETE")}
          >
            Remove PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setRemoving(false)}
          >
            Cancel
          </Button>
        </div>
      )}
      <div className="mt-5 flex items-center justify-between gap-4 border-t pt-4">
        <div>
          <label
            htmlFor="mobile-pdf-enabled"
            className="cursor-pointer text-sm font-medium"
          >
            Use mobile version on phones
          </label>
          <p
            id="mobile-pdf-help"
            className="mt-1 text-xs text-muted-foreground"
          >
            {ready
              ? "Uses the same sharing links and access settings."
              : "Upload a mobile PDF to enable this."}
          </p>
        </div>
        <Switch
          id="mobile-pdf-enabled"
          aria-describedby="mobile-pdf-help"
          checked={ready && version.mobileEnabled}
          disabled={!ready || busy}
          onCheckedChange={(enabled) =>
            void update("PATCH", undefined, enabled)
          }
        />
      </div>
    </section>
  );
}
