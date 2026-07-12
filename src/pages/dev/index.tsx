import { AIProviders } from "./components";
import { PageLayout } from "@/components/layouts";

const DevSpace = () => {
  return (
    <PageLayout title="AI Providers" description="Manage your AI providers">
      <AIProviders />
    </PageLayout>
  );
};

export default DevSpace;
