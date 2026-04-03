import WeeklySpecialsSection from "../_components/WeeklySpecialsSection";

export default async function SpecialsPage() {
  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      <div className="pt-10 pb-14">
        <WeeklySpecialsSection title="Special Offers" showViewProducts />
      </div>
    </main>
  );
}
