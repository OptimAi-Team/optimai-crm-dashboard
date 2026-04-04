"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X } from "lucide-react";

const CATEGORIES = [
  { value: "sop", label: "SOP" },
  { value: "campaign", label: "Campaign" },
  { value: "vehicle", label: "Vehicle" },
  { value: "brand", label: "Brand" },
  { value: "strategy", label: "Strategy" },
  { value: "lead", label: "Lead" },
  { value: "general", label: "General" },
];

export function BrainDumpSection() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [context, setContext] = useState("");
  const [whatIsThisFor, setWhatIsThisFor] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const allowedExtensions = [".pdf", ".doc", ".docx", ".txt"];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, DOCX, or TXT file",
        variant: "destructive",
      });
      return;
    }

    setIsReadingFile(true);

    try {
      let textContent = "";

      if (file.type === "text/plain" || fileExtension === ".txt") {
        textContent = await file.text();
      } else if (file.type === "application/pdf" || fileExtension === ".pdf") {
        // For PDF files, we'll extract text using FileReader and basic parsing
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let text = "";
        for (let i = 0; i < uint8Array.length; i++) {
          const char = String.fromCharCode(uint8Array[i]);
          if (char.match(/[\x20-\x7E\n\r\t]/)) {
            text += char;
          }
        }
        // Clean up the extracted text
        textContent = text
          .replace(/\s+/g, " ")
          .replace(/[^\x20-\x7E\n\r]/g, "")
          .trim();
        
        if (textContent.length < 50) {
          textContent = `[PDF Document: ${file.name}] - Content extraction limited. Please paste the text content manually if needed.`;
        }
      } else {
        // For DOC/DOCX, we'll read what we can
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let text = "";
        for (let i = 0; i < uint8Array.length; i++) {
          const char = String.fromCharCode(uint8Array[i]);
          if (char.match(/[\x20-\x7E\n\r\t]/)) {
            text += char;
          }
        }
        textContent = text
          .replace(/\s+/g, " ")
          .replace(/[^\x20-\x7E\n\r]/g, "")
          .trim();
        
        if (textContent.length < 50) {
          textContent = `[Document: ${file.name}] - Content extraction limited. Please paste the text content manually if needed.`;
        }
      }

      setUploadedFile({ name: file.name, content: textContent });
      setContext((prev) => {
        const separator = prev.trim() ? "\n\n---\n\n" : "";
        return prev + separator + `[UPLOADED: ${file.name}]\n${textContent}`;
      });

      toast({
        title: "File uploaded",
        description: `${file.name} content added to context`,
      });
    } catch (error) {
      console.error("Error reading file:", error);
      toast({
        title: "Failed to read file",
        description: "Could not extract text from the file",
        variant: "destructive",
      });
    } finally {
      setIsReadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeUploadedFile = () => {
    if (uploadedFile) {
      setContext((prev) => {
        const pattern = new RegExp(
          `\\n?\\n?---\\n?\\n?\\[UPLOADED: ${uploadedFile.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\][\\s\\S]*?(?=\\n\\n---|$)`,
          "g"
        );
        return prev.replace(pattern, "").trim();
      });
      setUploadedFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please give this knowledge a name",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Category required",
        description: "Please select a category",
        variant: "destructive",
      });
      return;
    }

    if (!context.trim()) {
      toast({
        title: "Content required",
        description: "Please add some content or knowledge",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const combinedContent = `[TITLE]: ${title} [CATEGORY]: ${category} [FOR]: ${whatIsThisFor || "N/A"} [CONTENT]: ${context}`;

    try {
      const response = await fetch(
        "https://optimaiteam.app.n8n.cloud/webhook/ee0c81e1-eee9-4e6d-aacf-7f245645a0f5",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: "optimai-cars",
            source: "brain_dump",
            content: combinedContent,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      toast({
        title: "Added to your knowledge vault",
        description: "Your knowledge has been saved successfully",
      });

      // Clear form
      setTitle("");
      setCategory("");
      setContext("");
      setWhatIsThisFor("");
      setUploadedFile(null);
    } catch (error) {
      console.error("Error submitting brain dump:", error);
      toast({
        title: "Something went wrong",
        description: "Failed to submit your knowledge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">Brain Dump</h2>
        <p className="text-sm text-muted-foreground">
          Feed your knowledge vault with structured information
        </p>
      </div>

      {/* Main card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        {/* Title field */}
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this a name"
            className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
          />
        </div>

        {/* Category dropdown */}
        <div className="space-y-2">
          <label htmlFor="category" className="block text-sm font-medium text-foreground">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200 appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: "right 0.75rem center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "1.5em 1.5em",
              paddingRight: "2.5rem",
            }}
          >
            <option value="" disabled>
              Select a category
            </option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Context textarea */}
        <div className="space-y-2">
          <label htmlFor="context" className="block text-sm font-medium text-foreground">
            Context
          </label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste your content, notes, or knowledge here"
            className="w-full min-h-[200px] p-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200 resize-none"
          />
        </div>

        {/* What is this for field */}
        <div className="space-y-2">
          <label htmlFor="whatIsThisFor" className="block text-sm font-medium text-foreground">
            What is this for?
          </label>
          <input
            id="whatIsThisFor"
            type="text"
            value={whatIsThisFor}
            onChange={(e) => setWhatIsThisFor(e.target.value)}
            placeholder="Who or what is this knowledge about?"
            className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
          />
        </div>

        {/* File upload section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Document Upload
          </label>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReadingFile}
              className="flex items-center gap-2"
            >
              {isReadingFile ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Reading file...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload a document
                </>
              )}
            </Button>
            {uploadedFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg border border-border">
                <FileText className="w-4 h-4 text-accent" />
                <span className="text-sm text-foreground truncate max-w-[200px]">
                  {uploadedFile.name}
                </span>
                <button
                  type="button"
                  onClick={removeUploadedFile}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Accepts PDF, DOC, DOCX, or TXT files
          </p>
        </div>

        {/* Submit button */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-6"
          >
            {isLoading ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Submitting...
              </>
            ) : (
              "Submit to Vault"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
