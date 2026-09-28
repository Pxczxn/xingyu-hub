"use client";

import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { communityApi, type CollectionSummary } from "@/lib/community-api";

export function AddToCollectionButton({
  objectType,
  objectId,
}: {
  objectType: string;
  objectId: string;
}) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    communityApi
      .getCollections()
      .then(setCollections)
      .catch(() => setCollections([]));
  }, []);

  async function addToCollection(collectionId: string) {
    setLoading(true);
    setMessage(null);
    try {
      await communityApi.addCollectionItem(collectionId, objectType, objectId);
      setMessage("已加入收藏夹");
    } catch {
      setMessage("加入失败，请确认已登录");
    } finally {
      setLoading(false);
    }
  }

  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm hover:bg-muted"
          disabled={loading}
        >
          <FolderPlus className="h-4 w-4" />
          收藏夹
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {collections.map((collection) => (
            <DropdownMenuItem key={collection.id} onSelect={() => void addToCollection(collection.id)}>
              {collection.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
