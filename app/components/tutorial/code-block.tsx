"use client";

import { useState } from "react";
import { Button } from "../ui/button";

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

interface CodeBlockProps {
  code: string;
  filename?: string;
}

export function CodeBlock({ code, filename }: CodeBlockProps) {
  const [icon, setIcon] = useState(CopyIcon);

  const copy = async () => {
    await navigator?.clipboard?.writeText(code);
    setIcon(CheckIcon);
    setTimeout(() => setIcon(CopyIcon), 2000);
  };

  return (
    <pre className="bg-muted rounded-md p-6 my-6 relative">
      {filename && (
        <div className="absolute top-0 left-0 bg-muted-foreground/20 text-xs px-2 py-1 rounded-br-md">
          {filename}
        </div>
      )}
      <Button
        size="icon"
        onClick={copy}
        variant={"outline"}
        className="absolute right-2 top-2"
      >
        {icon}
      </Button>
      <code className="text-xs p-3">{code}</code>
    </pre>
  );
}
