import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Privacy Policy | ORBIT | NEI-ISEP",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10" />

      <header className="mx-auto max-w-3xl px-4 pt-12 pb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <img src="/logo-extended.svg" alt="ORBIT" className="h-8 w-auto" />
          <Badge variant="secondary" className="text-[10px] font-medium tracking-wider uppercase">
            NEI-ISEP
          </Badge>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: June 29, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Scope</h2>
            <p>
              ORBIT is an internal operating system developed and operated exclusively for and by
              <strong className="text-foreground"> Núcleo de Estudantes de Informática do ISEP (NEI-ISEP)</strong>.
              This Privacy Policy governs the collection, use, and protection of personal data within this internal platform.
              Access to ORBIT is restricted to members, collaborators, and invited affiliates of NEI-ISEP.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Data Controller</h2>
            <p>
              The data controller is NEI-ISEP, headquartered at Instituto Superior de Engenharia do Porto,
              Rua Dr. António Bernardino de Almeida, 431, 4249-015 Porto, Portugal.
              For any data-related inquiries, contact the NEI-ISEP board at
              <a href="mailto:info@nei-isep.org" className="text-primary hover:underline mx-1">info@nei-isep.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Data We Collect</h2>
            <p className="mb-3">We collect and process the following personal data solely for internal operational purposes:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong className="text-foreground">Account data:</strong> name, email address (institutional @nei-isep.org), hashed password, and assigned roles/permissions.</li>
              <li><strong className="text-foreground">Usage data:</strong> activity logs, task assignments, project participation, and system interactions recorded for accountability and audit trail.</li>
              <li><strong className="text-foreground">Profile data:</strong> avatar, preferences, and settings voluntarily provided by the user.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Legal Basis</h2>
            <p>
              Processing is carried out under the legitimate interest of NEI-ISEP in managing its internal
              operations, projects, and membership, as well as under the performance of tasks carried out
              in the context of the association&apos;s activities. For optional features, consent is obtained where required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Sharing</h2>
            <p>
              Personal data is <strong className="text-foreground">not shared</strong> with third parties outside NEI-ISEP, except:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>As required by applicable Portuguese or EU law.</li>
              <li>With third-party infrastructure providers (e.g., cloud hosting) acting as data processors under a Data Processing Agreement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p>
              Data is retained for the duration of the user&apos;s affiliation with NEI-ISEP.
              Upon deactivation of an account, personal data is anonymized or deleted within 90 days,
              unless retention is required by law or for legitimate internal audit purposes (up to 2 years).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Your Rights</h2>
            <p className="mb-3">Under the GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Access, rectify, or erase your personal data.</li>
              <li>Restrict or object to processing.</li>
              <li>Data portability.</li>
              <li>Withdraw consent at any time (without affecting lawful processing prior to withdrawal).</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact <a href="mailto:info@nei-isep.org" className="text-primary hover:underline">info@nei-isep.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect personal data,
              including encryption in transit (TLS), hashed passwords (bcrypt), and access control based on
              roles and permissions. Only authorized NEI-ISEP members have access to the underlying infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Changes to This Policy</h2>
            <p>
              This Privacy Policy may be updated as internal practices evolve.
              Users will be notified of material changes via the platform or email.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/40">
          <p className="text-xs text-muted-foreground/60 text-center">
            ORBIT &mdash; Internal System of NEI-ISEP
          </p>
        </div>
      </main>
    </div>
  );
}
