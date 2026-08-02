import BlueprintField from "@/components/BlueprintField";
import SiteNav from "@/components/SiteNav";
import TechnicalEdges from "@/components/TechnicalEdges";
import ScrollHUD from "@/components/ScrollHUD";
import Hero from "@/components/Hero";
import ProblemSection from "@/components/ProblemSection";
import AgentConstellation from "@/components/AgentConstellation";
import PipelineSection from "@/components/PipelineSection";
import ReputationSection from "@/components/ReputationSection";
import AboutDocs from "@/components/AboutDocs";
import CTAFooter from "@/components/CTAFooter";

export default function Home() {
  return (
    <>
      <BlueprintField />
      <TechnicalEdges />
      <SiteNav />
      <ScrollHUD />
      <main className="relative z-10">
        <Hero />
        <ProblemSection />
        <AgentConstellation />
        <PipelineSection />
        <ReputationSection />
        <AboutDocs />
        <CTAFooter />
      </main>
    </>
  );
}
