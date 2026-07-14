import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Terms of Service | ORBIT | NEI-ISEP",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10" />

      <header className="mx-auto max-w-3xl px-4 pt-12 pb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <img src="/logo-extended-dark.svg" alt="ORBIT" className="h-8 w-auto block dark:hidden" />
          <img src="/logo-extended.svg" alt="ORBIT" className="h-8 w-auto hidden dark:block" />
          <Badge variant="secondary" className="text-[10px] font-medium tracking-wider uppercase">
            NEI-ISEP
          </Badge>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: June 29, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using ORBIT (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service.
              ORBIT is an internal platform operated by
              <strong className="text-foreground"> Núcleo de Estudantes de Informática do ISEP (NEI-ISEP)</strong>
              &nbsp;for the exclusive use of its members, collaborators, and invited affiliates.
              If you do not agree, you must not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Eligibility &amp; Access</h2>
            <p>
              Access is granted solely to current members of NEI-ISEP, ISEP students with an institutional
              email (@nei-isep.org), and other individuals explicitly authorized by the NEI-ISEP board.
              You are responsible for maintaining the confidentiality of your credentials.
              The NEI-ISEP board reserves the right to suspend or revoke access at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Acceptable Use</h2>
            <p className="mb-3">You agree to use the Platform exclusively for NEI-ISEP related activities, including but not limited to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Managing internal projects, tasks, and events.</li>
              <li>Communicating with other members regarding association activities.</li>
              <li>Accessing and managing resources relevant to NEI-ISEP operations.</li>
            </ul>
            <p className="mt-3">The following are expressly prohibited:</p>
            <ul className="list-disc pl-6 space-y-1.5 mt-2">
              <li>Using the Platform for commercial or external purposes.</li>
              <li>Uploading illegal, offensive, or unrelated content.</li>
              <li>Attempting to access data beyond your authorized permissions.</li>
              <li>Deliberately disrupting the operation of the Platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Account &amp; Data Integrity</h2>
            <p>
              You are responsible for the accuracy of the information you provide.
              Any account found to be associated with false or misrepresented identities may be revoked.
              Upon leaving NEI-ISEP or upon request, accounts may be deactivated and associated data handled
              as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Intellectual Property</h2>
            <p>
              The ORBIT platform, its code, design, and branding are developed and owned by NEI-ISEP,
              unless otherwise attributed. Content uploaded by users (documents, comments, etc.) remains
              the property of the respective authors, but users grant NEI-ISEP a non-exclusive,
              royalty-free license to store, display, and manage such content within the Platform
              for internal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Limitation of Liability</h2>
            <p>
              ORBIT is provided &ldquo;as is&rdquo; for internal organizational use. NEI-ISEP makes no warranties
              regarding uninterrupted availability or error-free operation. NEI-ISEP shall not be liable
              for any indirect or consequential damages arising from the use or inability to use the Platform.
              In no event shall NEI-ISEP&rsquo;s aggregate liability exceed the provision of corrective actions
              (e.g., data restoration) where feasible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Termination</h2>
            <p>
              NEI-ISEP reserves the right to terminate or suspend access to the Platform at its sole discretion,
              particularly in cases of violation of these Terms. Upon termination, your right to use the Platform
              ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Changes to Terms</h2>
            <p>
              These Terms may be updated periodically. Users will be informed of significant changes via
              platform notifications or email. Continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Portugal. Any disputes shall be resolved in the
              courts of Porto, Portugal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Contact</h2>
            <p>
              For any questions regarding these Terms, contact the NEI-ISEP board at
              <a href="mailto:info@nei-isep.org" className="text-primary hover:underline mx-1">info@nei-isep.org</a>.
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
