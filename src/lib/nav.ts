type NavPage = "home" | "rules" | "map-generator" | "cost-cards";

const LINKS: { page: NavPage; href: string; label: string }[] = [
  { page: "home", href: "./index.html", label: "Home" },
  { page: "rules", href: "./rules.html", label: "Rules" },
  { page: "map-generator", href: "./map-generator.html", label: "Map Generator" },
  { page: "cost-cards", href: "./cost-cards.html", label: "Cost Cards" },
];

const THEME_KEY = "catan-comp-theme";

function initThemeToggle(button: HTMLButtonElement): void {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    document.documentElement.setAttribute("data-theme", stored);
  }
  updateThemeToggleLabel(button);

  button.addEventListener("click", () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current =
      document.documentElement.getAttribute("data-theme") ?? (prefersDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeToggleLabel(button);
  });
}

function updateThemeToggleLabel(button: HTMLButtonElement): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current =
    document.documentElement.getAttribute("data-theme") ?? (prefersDark ? "dark" : "light");
  button.textContent = current === "dark" ? "☀︎" : "☾";
  button.setAttribute(
    "aria-label",
    current === "dark" ? "Switch to light theme" : "Switch to dark theme"
  );
}

export function renderNav(activePage: NavPage): void {
  const mount = document.getElementById("nav");
  if (!mount) return;

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `
    <div class="site-nav__inner">
      <a class="site-nav__brand" href="./index.html">Catan Companion</a>
      <div class="site-nav__links">
        ${LINKS.map(
          (link) =>
            `<a href="${link.href}"${link.page === activePage ? ' aria-current="page"' : ""}>${link.label}</a>`
        ).join("")}
      </div>
      <button class="theme-toggle" type="button"></button>
    </div>
  `;
  mount.replaceWith(nav);

  const toggle = nav.querySelector<HTMLButtonElement>(".theme-toggle");
  if (toggle) initThemeToggle(toggle);

  renderFooter();
}

/**
 * Every page calls renderNav, so the footer is rendered from here too. It carries the
 * trademark disclaimer: this is a fan-made reference, and the name has to make that plain.
 */
function renderFooter(): void {
  if (document.querySelector(".site-footer")) return;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-footer__inner">
      <p>
        <strong>Catan Companion</strong> is a fan-made reference, not affiliated with,
        endorsed by, or sponsored by CATAN GmbH or CATAN Studio. CATAN is a trademark of
        CATAN GmbH. Board layouts and component counts are taken from the published rule
        books.
      </p>
    </div>
  `;
  document.body.appendChild(footer);
}
