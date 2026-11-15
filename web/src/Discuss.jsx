/*
 * SkyShift community: every object and every approved candidate has its own conversation in the
 * GitHub Discussions of the SkyShift repository, where researchers can add information, answer the
 * person who reported it or point out errors. Nothing is stored by SkyShift: people use their own
 * GitHub account, and GitHub's moderation and reporting tools apply.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 */
import { IconChat } from './Icons.jsx'
import { t } from './i18n.js'

export const DISCUSSIONS = 'https://github.com/teoaguiilar/skyshift/discussions'

// Existing threads that mention this object; GitHub shows "New discussion" from there.
export const discussUrl = (name) => `${DISCUSSIONS}?discussions_q=${encodeURIComponent(name)}`

// A new thread with the object's name as title and a link back to this view of SkyShift.
export const newThreadUrl = (name) =>
  `${DISCUSSIONS}/new?${new URLSearchParams({
    category: 'general',
    title: `${name}: `,
    body: `SkyShift view: ${window.location.href}\n\n(What would you like to add, ask or correct? Please cite your sources.)`,
  })}`

export function DiscussButton({ name }) {
  return (
    <span className="discuss">
      <a className="btn action" href={discussUrl(name)} target="_blank" rel="noopener noreferrer">
        <IconChat />
        {t('Discuss')}
      </a>
      <a className="discuss-new" href={newThreadUrl(name)} target="_blank" rel="noopener noreferrer">
        {t('Start a new thread')}
      </a>
    </span>
  )
}
