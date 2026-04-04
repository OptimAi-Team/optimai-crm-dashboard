"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface KnowledgeNode {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  created_at: string;
}

export function VaultSection() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          "https://oywbmhziosidnfevgtsj.supabase.co/rest/v1/knowledge_nodes?select=*&order=created_at.desc",
          {
            headers: {
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d2JtaHppb3NpZG5mZXZndHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjkzMjIsImV4cCI6MjA5MDg0NTMyMn0.5RsYCsnSBhNTcaMdCBfHQEXziMYFIiv6iUK9Fw5wEOo",
              "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d2JtaHppb3NpZG5mZXZndHNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI2OTMyMiwiZXhwIjoyMDkwODQ1MzIyfQ.1NlDv2TuQo9Jd2v6D_vtyfgo4AjT3ZpEDMrUgVyREok",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch knowledge nodes");
        }

        const data = await response.json();
        setNodes(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching nodes:", err);
        setError("Failed to load knowledge vault");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNodes();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">Vault</h2>
        <p className="text-sm text-muted-foreground">Your knowledge repository</p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && nodes.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
          <p className="text-muted-foreground">Your vault is empty</p>
          <p className="text-sm text-muted-foreground">
            Start adding to your knowledge vault through the Brain Dump section
          </p>
        </div>
      )}

      {/* Knowledge nodes grid */}
      {!isLoading && !error && nodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node, index) => (
            <div
              key={node.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-accent/50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
            >
              <div className="space-y-3">
                {/* Category badge */}
                {node.category && (
                  <Badge variant="outline" className="w-fit">
                    {node.category}
                  </Badge>
                )}

                {/* Title */}
                <h3 className="text-sm font-semibold text-foreground line-clamp-2">
                  {node.title}
                </h3>

                {/* Content preview */}
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {node.content}
                </p>

                {/* Tags */}
                {node.tags && node.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {node.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Date */}
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  {new Date(node.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
