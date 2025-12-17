import { Link } from "@tanstack/react-router";
import { useTranslation, Trans } from "react-i18next";
import { FaXTwitter, FaLinkedin, FaGithub } from "react-icons/fa6";

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    {
      name: "X",
      href: "https://x.com/auditmos",
      icon: FaXTwitter,
    },
    {
      name: "LinkedIn",
      href: "https://www.linkedin.com/company/auditmos",
      icon: FaLinkedin,
    },
    {
      name: "GitHub",
      href: "https://github.com/auditmos",
      icon: FaGithub,
    },
  ];

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
        <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-start md:space-y-0">
          <div className="text-sm">
            <p className="text-muted-foreground">
              <Trans
                i18nKey="footer.copyright"
                values={{ year: currentYear }}
                components={[
                  <a key="link" href="https://auditmos.com" target="_blank" rel="noopener noreferrer" className="hover:underline" />
                ]}
              />
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-semibold mb-1">{t("footer.headquarters")}</p>
            <a
              href="https://ariregister.rik.ee/eng/company/17025406/Auditmos-O%C3%9C?lang=en&"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground hover:underline transition-colors inline-block"
            >
              Auditmos OU
            </a>
            <address className="not-italic mt-1">
              Harju maakond, Tallinn, Kesklinna linnaosa,<br />
              Narva mnt 13-27, 10151
            </address>
          </div>

          <div className="flex flex-col space-y-4">
            <nav className="flex flex-col space-y-2 text-sm">
              <Link
                to="/privacy-policy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("footer.privacyPolicy")}
              </Link>
              <Link
                to="/legal"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("footer.legal")}
              </Link>
            </nav>

            <div className="flex space-x-4">
              {socialLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={link.name}
                  >
                    <IconComponent className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
