// app/admin/shipping/page.tsx
import ShippingSettingsClient from "./ShippingSettingsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ShippingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-white">Shipping Settings</h1>
        <p className="mt-2 text-sm text-white/60">
          Control your shipping flat rate and free-delivery threshold. Values are edited in pounds and saved in pennies.
        </p>
      </header>

      <ShippingSettingsClient />
    </main>
  );
}