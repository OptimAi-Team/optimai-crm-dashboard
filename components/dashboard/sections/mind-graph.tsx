"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KnowledgeNode {
  id: string;
  title: string;
  category: string;
  tags: string[];
  links?: string[];
  content: string;
  created_at: string;
}

interface GraphNode {
  id: string;
  name: string;
  category: string;
  tags: string[];
  content: string;
  color: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

const categoryColors: Record<string, string> = {
  General: "#00ffff",
  SOP: "#00ff88",
  Campaign: "#ff8800",
  Vehicle: "#aa44ff",
  Brand: "#ff1493",
  Strategy: "#ffff00",
};

const SUPABASE_URL = "https://oywbmhziosidnfevgtsj.supabase.co/rest/v1/knowledge_nodes?select=*&order=created_at.desc";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d2JtaHppb3NpZG5mZXZndHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjkzMjIsImV4cCI6MjA5MDg0NTMyMn0.5RsYCsnSBhNTcaMdCBfHQEXziMYFIiv6iUK9Fw5wEOo";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d2JtaHppb3NpZG5mZXZndHNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI2OTMyMiwiZXhwIjoyMDkwODQ1MzIyfQ.1NlDv2TuQo9Jd2v6D_vtyfgo4AjT3ZpEDMrUgVyREok";

function generateStarfield(count: number): { x: number; y: number; size: number; opacity: number }[] {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
    });
  }
  return stars;
}

export function MindGraphSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [stars] = useState(() => generateStarfield(80));
  const highlightNodesRef = useRef<Set<string>>(new Set());
  const highlightLinksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    let animationFrame: number;

    const initGraph = async () => {
      try {
        const response = await fetch(SUPABASE_URL, {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch knowledge nodes");
        }

        const nodes: KnowledgeNode[] = await response.json();

        if (!isMounted) return;

        const graphNodes: GraphNode[] = nodes.map((node) => ({
          id: node.id,
          name: node.title,
          category: node.category || "General",
          tags: node.tags || [],
          content: node.content,
          color: categoryColors[node.category] || categoryColors.General,
          val: 4,
        }));

        const graphLinks: GraphLink[] = [];
        const addedLinks = new Set<string>();

        for (let i = 0; i < nodes.length; i++) {
          const nodeA = nodes[i];
          const tagsA = nodeA.tags || [];
          const linksA = nodeA.links || [];

          for (const linkId of linksA) {
            const linkKey = [nodeA.id, linkId].sort().join("-");
            if (!addedLinks.has(linkKey) && nodes.some(n => n.id === linkId)) {
              graphLinks.push({ source: nodeA.id, target: linkId, strength: 1 });
              addedLinks.add(linkKey);
            }
          }

          for (let j = i + 1; j < nodes.length; j++) {
            const nodeB = nodes[j];
            const tagsB = nodeB.tags || [];
            const matchingTags = tagsA.filter((tag) => tagsB.includes(tag));

            if (matchingTags.length > 0) {
              const linkKey = [nodeA.id, nodeB.id].sort().join("-");
              if (!addedLinks.has(linkKey)) {
                graphLinks.push({ 
                  source: nodeA.id, 
                  target: nodeB.id, 
                  strength: Math.min(matchingTags.length / 2, 1) 
                });
                addedLinks.add(linkKey);
              }
            }
          }
        }

        const ForceGraph3D = await import("3d-force-graph").then(m => m.default);

        if (!isMounted || !containerRef.current) return;

        containerRef.current.innerHTML = "";

        const graph = ForceGraph3D()(containerRef.current)
          .graphData({ nodes: graphNodes, links: graphLinks })
          .nodeLabel("")
          .linkColor((link: any) => {
            const linkKey = [
              typeof link.source === "object" ? link.source.id : link.source,
              typeof link.target === "object" ? link.target.id : link.target
            ].sort().join("-");
            
            if (highlightLinksRef.current.has(linkKey)) {
              return "rgba(255, 255, 255, 0.9)";
            }
            return link.strength > 0.5 
              ? "rgba(100, 200, 255, 0.25)" 
              : "rgba(100, 150, 200, 0.08)";
          })
          .linkWidth((link: any) => {
            const linkKey = [
              typeof link.source === "object" ? link.source.id : link.source,
              typeof link.target === "object" ? link.target.id : link.target
            ].sort().join("-");
            
            if (highlightLinksRef.current.has(linkKey)) {
              return 2;
            }
            return link.strength > 0.5 ? 1.5 : 0.5;
          })
          .linkOpacity(1)
          .linkDirectionalParticles((link: any) => {
            const linkKey = [
              typeof link.source === "object" ? link.source.id : link.source,
              typeof link.target === "object" ? link.target.id : link.target
            ].sort().join("-");
            
            if (highlightLinksRef.current.has(linkKey)) {
              return 4;
            }
            return link.strength > 0.5 ? 2 : 0;
          })
          .linkDirectionalParticleWidth(1.5)
          .linkDirectionalParticleSpeed(0.006)
          .linkDirectionalParticleColor((link: any) => {
            const linkKey = [
              typeof link.source === "object" ? link.source.id : link.source,
              typeof link.target === "object" ? link.target.id : link.target
            ].sort().join("-");
            
            if (highlightLinksRef.current.has(linkKey)) {
              return "#ffffff";
            }
            return "rgba(150, 220, 255, 0.8)";
          })
          .backgroundColor("rgba(0,0,0,0)")
          .onNodeClick((node: any) => {
            setSelectedNode(node as GraphNode);
          })
          .onNodeHover((node: any) => {
            highlightNodesRef.current.clear();
            highlightLinksRef.current.clear();
            
            if (node) {
              highlightNodesRef.current.add(node.id);
              
              const links = graph.graphData().links;
              links.forEach((link: any) => {
                const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                const targetId = typeof link.target === "object" ? link.target.id : link.target;
                
                if (sourceId === node.id || targetId === node.id) {
                  const linkKey = [sourceId, targetId].sort().join("-");
                  highlightLinksRef.current.add(linkKey);
                  highlightNodesRef.current.add(sourceId === node.id ? targetId : sourceId);
                }
              });
              
              const coords = graph.graph2ScreenCoords(node.x, node.y, node.z);
              setHoveredNode({ 
                node: node as GraphNode, 
                x: coords.x, 
                y: coords.y 
              });
            } else {
              setHoveredNode(null);
            }
            
            graph.nodeColor(graph.nodeColor());
            graph.linkColor(graph.linkColor());
            graph.linkWidth(graph.linkWidth());
            graph.linkDirectionalParticles(graph.linkDirectionalParticles());
          })
          .nodeThreeObject((node: any) => {
            const THREE = (window as any).THREE;
            if (!THREE) return null;
            
            const isHighlighted = highlightNodesRef.current.has(node.id);
            const baseSize = isHighlighted ? 6 : 4;
            
            const group = new THREE.Group();
            
            const coreGeometry = new THREE.SphereGeometry(baseSize, 32, 32);
            const coreMaterial = new THREE.MeshBasicMaterial({
              color: node.color,
              transparent: true,
              opacity: isHighlighted ? 1 : 0.9,
            });
            const core = new THREE.Mesh(coreGeometry, coreMaterial);
            group.add(core);
            
            const glowSize = isHighlighted ? baseSize * 2.5 : baseSize * 1.8;
            const glowGeometry = new THREE.SphereGeometry(glowSize, 32, 32);
            const glowMaterial = new THREE.MeshBasicMaterial({
              color: node.color,
              transparent: true,
              opacity: isHighlighted ? 0.4 : 0.15,
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            group.add(glow);
            
            if (isHighlighted) {
              const haloGeometry = new THREE.SphereGeometry(baseSize * 4, 32, 32);
              const haloMaterial = new THREE.MeshBasicMaterial({
                color: "#ffffff",
                transparent: true,
                opacity: 0.15,
              });
              const halo = new THREE.Mesh(haloGeometry, haloMaterial);
              group.add(halo);
            }
            
            return group;
          })
          .nodeThreeObjectExtend(false)
          .d3AlphaDecay(0.008)
          .d3VelocityDecay(0.15)
          .warmupTicks(100)
          .cooldownTicks(0);

        graphRef.current = graph;

        graph.cameraPosition({ x: 300, y: 200, z: 300 });
        
        let angle = 0;
        const distance = 400;
        const rotateCamera = () => {
          if (!isMounted) return;
          angle += 0.001;
          graph.cameraPosition({
            x: distance * Math.sin(angle),
            y: 100 + Math.sin(angle * 0.5) * 50,
            z: distance * Math.cos(angle)
          });
          animationFrame = requestAnimationFrame(rotateCamera);
        };
        rotateCamera();

        const handleResize = () => {
          if (containerRef.current && graphRef.current) {
            graphRef.current.width(containerRef.current.clientWidth);
            graphRef.current.height(containerRef.current.clientHeight);
          }
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        setIsLoading(false);

        return () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (err) {
        console.error("Error initializing graph:", err);
        if (isMounted) {
          setError("Failed to load mind graph");
          setIsLoading(false);
        }
      }
    };

    initGraph();

    return () => {
      isMounted = false;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (graphRef.current) {
        graphRef.current._destructor?.();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ marginLeft: 0 }}>
      {/* Background with gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, rgba(20, 30, 60, 0.4) 0%, rgba(0, 0, 0, 1) 70%)",
        }}
      />
      
      {/* Starfield */}
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/* Graph container */}
      <div ref={containerRef} className="w-full h-full relative z-10" />

      {/* Pulsing animation styles */}
      <style jsx global>{`
        @keyframes pulse-glow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
        
        @keyframes flow-electricity {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div 
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at center, rgba(20, 30, 60, 0.6) 0%, rgba(0, 0, 0, 1) 70%)",
            }}
          />
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              <div className="absolute inset-0 w-10 h-10 rounded-full bg-cyan-400/20 blur-xl animate-pulse" />
            </div>
            <p className="text-sm text-cyan-300/80 tracking-wide">Initializing neural network...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/90">
          <div className="bg-gray-900/90 border border-red-500/30 rounded-xl p-6 max-w-sm backdrop-blur-sm">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredNode && (
        <div 
          className="absolute z-30 pointer-events-none"
          style={{
            left: hoveredNode.x + 15,
            top: hoveredNode.y - 10,
            transform: "translateY(-50%)",
          }}
        >
          <div 
            className="px-3 py-2 rounded-lg backdrop-blur-md border"
            style={{
              background: "rgba(0, 0, 0, 0.8)",
              borderColor: hoveredNode.node.color,
              boxShadow: `0 0 20px ${hoveredNode.node.color}40`,
            }}
          >
            <p className="text-sm font-medium text-white whitespace-nowrap">
              {hoveredNode.node.name}
            </p>
            <p 
              className="text-xs mt-0.5"
              style={{ color: hoveredNode.node.color }}
            >
              {hoveredNode.node.category}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div 
        className="absolute bottom-6 left-6 rounded-xl p-4 space-y-2 z-20 backdrop-blur-md border border-white/10"
        style={{
          background: "rgba(0, 0, 0, 0.7)",
        }}
      >
        <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Neural Categories</p>
        <div className="space-y-2">
          {Object.entries(categoryColors).map(([category, color]) => (
            <div key={category} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ 
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
              <span className="text-xs text-white/80">{category}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Node detail card */}
      {selectedNode && (
        <div 
          className="absolute top-6 right-6 w-80 rounded-xl p-5 space-y-4 z-20 animate-in fade-in slide-in-from-right-4 duration-300 backdrop-blur-md border"
          style={{
            background: "rgba(0, 0, 0, 0.85)",
            borderColor: `${selectedNode.color}40`,
            boxShadow: `0 0 30px ${selectedNode.color}20`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-white line-clamp-2">
              {selectedNode.name}
            </h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Badge
            variant="outline"
            className="w-fit"
            style={{
              borderColor: selectedNode.color,
              color: selectedNode.color,
              boxShadow: `0 0 10px ${selectedNode.color}30`,
            }}
          >
            {selectedNode.category}
          </Badge>

          <p className="text-xs text-white/70 leading-relaxed line-clamp-8">
            {selectedNode.content}
          </p>

          {selectedNode.tags && selectedNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/10">
              {selectedNode.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 rounded-md bg-white/5 text-white/60 border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
