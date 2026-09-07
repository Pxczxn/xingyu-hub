import { redirect } from "next/navigation";
export default function GroupRequestsPage({ params }: { params: { conversationId: string } }) { redirect(`/messages/group/${params.conversationId}/applications`); }
