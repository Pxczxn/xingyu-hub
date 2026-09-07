import { redirect } from "next/navigation";
export default function GroupOwnershipPage({ params }: { params: { conversationId: string } }) { redirect(`/messages/group/${params.conversationId}/settings`); }
