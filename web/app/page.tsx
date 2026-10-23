import { Bento, Boundaries, FinalCta, Footer, Hero, HowItWorks, Nav, Principles } from "@/components/landing/Sections";

export default function Landing() {
  return (
    <div className="land">
      <Nav />
      <main>
        <Hero />
        <Principles />
        <HowItWorks />
        <Bento />
        <Boundaries />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
