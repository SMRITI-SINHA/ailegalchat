import { useState, useEffect } from "react";

const MESSAGES = [
  "Weighing precedents on the scales of justice…",
  "Consulting the corpus juris…",
  "Scanning the legislative landscape…",
  "Deliberating the finer points of law…",
  "Invoking the spirit of the Constitution…",
  "Cross-referencing case law and statutes…",
  "Summoning judicial reasoning…",
  "Navigating the labyrinth of legislation…",
  "Parsing the letter of the law…",
  "Canvassing the jurisprudence…",
  "Examining the annals of precedent…",
  "Marshalling the authorities…",
  "Sifting through the codified wisdom…",
  "Distilling the ratio decidendi…",
  "Tracing the legislative intent…",
  // Indian law facts
  "Did you know? India's Constitution — 145,000 words — is the world's longest written constitution.",
  "Did you know? Article 32 was called the 'heart and soul' of the Constitution by Dr. B.R. Ambedkar.",
  "Did you know? The Kesavananda Bharati (1973) judgment established the Basic Structure doctrine.",
  "Did you know? India's Evidence Act of 1872 has guided courts for over 150 years.",
  "Did you know? The Supreme Court of India receives over 70,000 fresh cases every year.",
  "Did you know? Article 21 now encompasses the right to privacy, livelihood, and a dignified life.",
  "Did you know? The POSH Act 2013 traces its origins to the Vishaka Guidelines laid down in 1997.",
  "Did you know? The RTI Act (2005) mandates government response within 30 days of an application.",
  "Did you know? India has 25 High Courts serving 28 states and 8 Union Territories.",
  "Did you know? The IPC of 1860 remained the backbone of Indian criminal law for over 160 years.",
  "Did you know? Maneka Gandhi v. Union of India (1978) expanded Article 21 to include 'due process'.",
  "Did you know? Legal aid in India is a fundamental right under Article 39-A of the Constitution.",
  "Did you know? The Bharatiya Nyaya Sanhita 2023 replaced the IPC, effective July 2024.",
  "Did you know? India's first Law Commission was constituted in 1955 under M.C. Setalvad.",
  "Did you know? Under CPC Order 39, courts can grant ad-interim injunctions within 24 hours.",
];

interface AiThinkingTextProps {
  size?: "sm" | "xs";
  color?: string;
}

export function AiThinkingText({ size = "sm", color }: AiThinkingTextProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * MESSAGES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 400);
    }, 3200);
    return () => clearInterval(cycle);
  }, []);

  const textClass = size === "xs" ? "text-xs" : "text-sm";
  const style: React.CSSProperties = {
    transition: "opacity 0.4s ease",
    opacity: visible ? 1 : 0,
    fontStyle: "italic",
    color: color ?? undefined,
  };

  return (
    <span className={`${textClass} text-muted-foreground`} style={style}>
      {MESSAGES[index]}
    </span>
  );
}
