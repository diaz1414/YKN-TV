import React from 'react';

/**
 * Utility to format bracket terms (e.g. [CH 1], [IOS 2]) in a string as styled React badges.
 */
export const formatBracketText = (text: string | undefined): React.ReactNode => {
  if (!text) return '';
  
  // Match brackets containing CH, IOS, S, or RTB (case-insensitive)
  const regex = /(\[(?:CH|IOS|S|RTB)[^\]]*\])/gi;
  const parts = text.split(regex);
  
  if (parts.length === 1) return text;
  
  return (
    <>
      {parts.map((part, index) => {
        if (regex.test(part)) {
          const upperPart = part.toUpperCase();
          let badgeClass = "text-primary bg-zinc-900 border border-primary/40"; // Gold for CH / default
          
          if (upperPart.includes('IOS')) {
            badgeClass = "text-emerald bg-zinc-900 border border-emerald/40"; // Emerald green for IOS
          } else if (upperPart.includes('RTB')) {
            badgeClass = "text-netflix-red bg-zinc-900 border border-netflix-red/40"; // Red for RTB
          } else if (upperPart.includes('[S') || upperPart.startsWith('[S')) {
            badgeClass = "text-brand-purple bg-zinc-900 border border-brand-purple/40"; // Purple for S
          }

          return (
            <span
              key={index}
              className={`${badgeClass} font-black px-2 py-0.5 rounded-md text-[11px] inline-block uppercase tracking-wider mx-1.5 select-none`}
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </>
  );
};
