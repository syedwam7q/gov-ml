import { ChatIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Chat",
};

export default function ChatPage() {
  return (
    <PageStub
      label="Chat"
      description="Full-screen Governance Assistant with tool-call rendering and persistent transcript. The drawer (⌘K) is the quick-access view; this is the long-form workspace."
      arrivingIn="phase 8"
      icon={<ChatIcon width={24} height={24} />}
    />
  );
}
