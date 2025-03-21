import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import JoinRoom from "@/components/rooms/JoinRoom";
import InterviewRoom from "@/components/rooms/InterviewRoom";
import EditRoom from "@/components/rooms/EditRoom";
import ThankYouPage from "@/components/rooms/ThankYouPage";
import RoomCandidates from "@/components/rooms/RoomCandidates";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>GenAI Interviews - AI-Powered Mock Interviews</title>
        <meta name="description" content="Get AI-powered interview preparation with real-world mock interviews. Elevate your career with GenAI Interviews." />
        <meta name="keywords" content="AI Interviews, Mock Interviews, AI Career, GenAI, Crackadmission" />
        <meta name="author" content="Crackadmission" />
        <link rel="canonical" href="https://crackadmission.com" />

        {/* Open Graph Meta Tags (For Social Sharing) */}
        <meta property="og:title" content="GenAI Interviews - AI-Powered Mock Interviews" />
        <meta property="og:description" content="AI-powered interview preparation with real-world examples to boost your career success." />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://crackadmission.com" />
        <meta property="og:type" content="website" />

        {/* Twitter Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="GenAI Interviews - AI-Powered Mock Interviews" />
        <meta name="twitter:description" content="AI-powered interview preparation to enhance your job readiness." />
        <meta name="twitter:image" content="/og-image.png" />

        {/* JSON-LD Structured Data for SEO */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            "name": "Crackadmission",
            "url": "https://crackadmission.com",
            "logo": "https://crackadmission.com/logo.png",
            "description": "AI-powered mock interviews for career growth.",
            "sameAs": [
              "https://www.linkedin.com/company/crackadmission",
              "https://twitter.com/crackadmission"
            ]
          })}
        </script>
      </Helmet>

      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/join/:shareId" element={<JoinRoom />} />
          <Route path="/room/:roomId" element={<InterviewRoom />} />
          <Route path="/room/:roomId/edit" element={<EditRoom />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/room/:roomId/candidates" element={<RoomCandidates />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </HelmetProvider>
  );
}
