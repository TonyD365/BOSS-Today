import type { Media, User } from '@/payload-types'

/** Only the public parts of a staff profile ever leave the server. */
export type Author = Pick<User, 'id' | 'name' | 'title' | 'bio' | 'slug'> & {
  photo?: Media | null
}

export const toAuthor = (user: User | number): Author | undefined => {
  if (typeof user === 'number') return undefined
  return {
    id: user.id,
    name: user.name,
    title: user.title,
    bio: user.bio,
    slug: user.slug,
    photo: user.photo && typeof user.photo === 'object' ? user.photo : null,
  }
}
