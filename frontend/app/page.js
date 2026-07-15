import AuroraBackground from "@/components/AuroraBackground";
import HeroSection from "@/components/HeroSection";
import MeetingPreview from "@/components/MeetingPreview";
import Navbar from "@/components/Navbar";


export default function Home() {

  return (

    <main className="
      relative
      min-h-screen
      overflow-hidden
    ">

      <AuroraBackground />

      <Navbar />


      <div
        className="
          relative
          z-10
          min-h-screen
          flex
          items-center
          justify-center
          px-6
          pt-24
        "
      >

        <div
          className="
            w-full
            max-w-7xl
            grid
            grid-cols-1
            lg:grid-cols-2
            gap-12
            items-center
          "
        >

          <HeroSection />

          <MeetingPreview />

        </div>

      </div>


    </main>

  );

}