import ExpensesClient from "./ui/ExpensesClient";

export const dynamic = "force-dynamic";

export default function AdminExpensesPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <div>
          <p className="text-white/50 text-sm">Admin</p>
          <h1 className="text-3xl font-semibold mt-1">Business Costs</h1>
          <p className="text-white/60 mt-2">
            Add rent, postage, materials, packaging, subscriptions, ads — these feed into “True Profit” on Analytics.
          </p>
        </div>

        <div className="mt-8">
          <ExpensesClient />
        </div>
      </div>
    </main>
  );
}