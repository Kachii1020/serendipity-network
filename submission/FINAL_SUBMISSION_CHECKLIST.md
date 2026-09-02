# Serendipity final submission checklist

## Status

The technical package is complete. The entry is not submitted until the user
uploads the video publicly, completes identity/eligibility fields, accepts the
rules, and presses Devpost's final Submit button.

Official deadline: **September 3, 2026 at 1:00pm PDT / September 4, 2026 at
5:00am JST**. Internal target: finish at least 6 hours earlier.

## Verified public assets

- Live app: <https://serendipity-phase0-hub.vercel.app>
- Direct planner: <https://serendipity-phase0-hub.vercel.app/plan>
- Public source: <https://github.com/Kachii1020/serendipity-network>
- License: MIT, detected by GitHub
- Production deployment: `dpl_F66xuSv6HMpdthhMqHrs3NDgJn8W`
- Production search: 20/20, p95 432ms, 20 unique correlations
- Browser: 14/14
- Repository: 389/389 tests, 8/8 typechecks, 8/8 builds
- Source audit: 20/20
- Security: 5/5; 65 built assets scanned
- Lighthouse: home 99/100/100/100; planner 98/100/100/100
- Latest CI: <https://github.com/Kachii1020/serendipity-network/actions/runs/33474093450>

## Upload files

| Devpost field               | File                              |
| --------------------------- | --------------------------------- |
| Project thumbnail, 3:2      | `serendipity-thumbnail-3x2.png`   |
| Gallery — inputs            | `gallery-01-inputs.png`           |
| Gallery — route             | `gallery-02-route.png`            |
| Gallery — evidence          | `gallery-03-evidence.png`         |
| Gallery — WebMCP            | `gallery-04-webmcp.png`           |
| YouTube thumbnail, 16:9     | `serendipity-cover.png`           |
| Video upload source         | `serendipity-demo.mp4`            |
| Full text and field mapping | `DEVPOST_SUBMISSION.md`           |
| Frozen claims               | `fact-lock-final.json`            |
| One-file local handoff      | `serendipity-devpost-package.zip` |

## Video facts

- 2:33.566, below the three-minute limit
- 1920×1080, 30fps, H.264
- AAC stereo, 48kHz
- English narration and burned-in English captions
- No copyrighted music, third-party photos, or third-party logos
- WebMCP segment is explicitly described as a Chrome compatibility client, not
  a real Sol/Terra capture
- Plain venue names appear as factual references. The user must make the final
  submission-rights decision under the hackathon's trademark clause.

## Devpost order

1. Log in and join The WebMCP Challenge.
2. Start a new project rather than importing an unrelated portfolio project.
3. Manage Team: select Individual if solo; otherwise add actual contributors.
4. Project Overview:
   - Name: `Serendipity`
   - Tagline: `One Tokyo evening, planned with evidence.`
   - Upload `serendipity-thumbnail-3x2.png`.
5. Project Details:
   - Paste the Project Story from `DEVPOST_SUBMISSION.md`.
   - Add built-with tags: WebMCP, TypeScript, Next.js, React, Vercel, AJV,
     Vitest, Playwright.
   - Add the public live URL.
   - Upload the four gallery images.
6. Upload `serendipity-demo.mp4` to YouTube:
   - Visibility: Public
   - Audience: Not made for kids
   - Use the title, description, and thumbnail in `DEVPOST_SUBMISSION.md`.
   - Confirm embedding is allowed and playback works while logged out.
7. Paste the public YouTube share URL into Video demo link.
8. Additional Details:
   - select the user's actual submitter type and legal country of residence;
   - category: Web / Machine Learning & AI;
   - repository URL: public GitHub URL above;
   - license: MIT;
   - credentials: none required;
   - use the prepared new-project, extension, and tool-feedback answers.
9. Save Draft and open View:
   - test live app, repository, and video while logged out;
   - verify thumbnail crop and all gallery captions;
   - verify the story has no placeholder or private information.
10. The user confirms eligibility, accepts the official rules, and presses
    Submit project.
11. Capture the Submitted status and timestamp. Do not stop at Draft.

## User-only gates

- Confirm age-of-majority and country eligibility.
- Confirm Individual versus Team and every actual contributor.
- Listen to the entire video with headphones; approve pronunciation and pacing.
- Decide whether plain factual venue-name display is acceptable under the
  submission trademark clause.
- Upload publicly to YouTube and provide the URL.
- Review and accept the binding rules.
- Perform the final Submit action.

## Do not change before submission

- Do not enable Google Places.
- Do not add features or another Site Tool.
- Do not claim real Sol/Terra execution.
- Do not replace the production deployment unless a mandatory smoke fails.
- Do not change source-pack facts, prices, or hours.
