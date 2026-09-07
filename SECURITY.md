# Security Policy

## Supported versions

Nothing is published yet. The first release of all three packages will be
`0.1.0`; until it ships there is no released version to carry a fix.

Once releases begin, security fixes land on **the latest release only**.

| Version              | Security fixes                        |
| -------------------- | ------------------------------------- |
| Latest `0.x` release | Yes                                   |
| Any earlier `0.x`    | No — upgrade to the latest            |
| Unreleased `main`    | Fixed as part of ordinary development |

While the packages are below `1.0` there are no parallel maintained lines and
nothing is back-ported. A fix means a new release, and the way to get it is to
upgrade. If that is a problem for you, say so in the report — it is useful to
know before the policy hardens at `1.0`.

The three packages version together, so a fix in
`@joihouse/magnet-cursor-core` is republished across `-react` and `-vue` at the
same version.

## Reporting a vulnerability

**Use GitHub's private vulnerability reporting**, which keeps the report
between you and the maintainers until a fix ships:

> [github.com/JoiHouse/magnet-cursor/security/advisories/new](https://github.com/JoiHouse/magnet-cursor/security/advisories/new)

You can also reach it from the repository's **Security** tab → _Report a
vulnerability_.

Please include:

- what an attacker can do, not only what the code does;
- the affected package and version, and the browser if it matters;
- the smallest page or snippet that shows it — a single HTML file is ideal;
- the options passed to the effect, since most of the surface is configuration.

### Do not open a public issue

**Do not report an unfixed vulnerability in a public issue, pull request,
discussion or commit message.** A public report gives every user of the library
the problem and no fix at the same time. That includes "just asking" about
something that looks exploitable — ask privately and we will tell you.

If you have already opened one, do not delete it: say so in the private report
instead. Deleting it does not unpublish it, and knowing what is already public
changes how quickly a fix has to go out.

Once a fix is released we will credit you in the advisory unless you would
rather stay anonymous. Say which you prefer in the report.

## Response times

This is a small project, so these are targets rather than guarantees, measured
from when the report arrives:

| Stage                                                     | Target           |
| --------------------------------------------------------- | ---------------- |
| Acknowledge that a human has read it                      | 3 business days  |
| Assessment: whether it is a vulnerability, and how severe | 7 calendar days  |
| Fix released for a high-severity issue                    | 30 calendar days |
| Fix released for anything lower                           | Next release     |

If a target slips you will hear why rather than hear nothing. If you have had
no reply at all after 7 days, treat that as the report having gone astray and
send a plain, detail-free nudge through the same channel.

We ask for the fix to ship before public disclosure. If you plan to disclose on
your own schedule, tell us the date in the first message so the release can be
planned around it.

## Scope

These are browser UI libraries. There is no server, no network traffic, no
authentication and no persistence — so the realistic surface is narrower than
it is for most dependencies, and it helps to know where it actually is.

**In scope**

- Anything that turns library **options** into markup or CSS. Two SVG filters
  are built by interpolating option-derived values into `innerHTML`
  (`cursor.ts`, `liquid-surface.ts`), and several options are written straight
  into custom properties — `color`, `itemColor`, `blendMode` among them.
- Anything read off the page: the mode, colour and item attributes, and the
  selectors matched against the DOM.
- Prototype pollution through the option merging.
- A denial of service that a page cannot recover from — a render loop that will
  not stop, or unbounded allocation.

**Out of scope**

- Passing attacker-controlled strings as options is worth reporting, but tell
  us how the value reached the option. Options are currently treated as trusted
  developer configuration; if that assumption is wrong for a real application
  shape, that is the finding.
- Anything requiring the attacker to already run script on the page.
- Vulnerabilities in the dependencies of the demo site, which is not part of
  this repository and not part of any published package.
- Missing hardening headers, and reports produced by a scanner with no working
  example attached.

## Fixed issues

Published advisories, when there are any, appear under
[Security → Advisories](https://github.com/JoiHouse/magnet-cursor/security/advisories).
