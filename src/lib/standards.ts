/**
 * A first draft of the editorial standards page (/standards/). The newsroom
 * edits it in Site settings; until they do, this is what the field holds.
 */
const text = (value: string) => ({
  type: 'text',
  version: 1,
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
})
const node = { version: 1, direction: 'ltr' as const, format: '' as const, indent: 0 }
const h2 = (value: string) => ({ ...node, type: 'heading', tag: 'h2', children: [text(value)] })
const p = (value: string) => ({
  ...node,
  type: 'paragraph',
  textFormat: 0,
  children: [text(value)],
})

const SECTIONS: [string, string[]][] = [
  [
    'Who we are',
    [
      'BOSS Today is an independent student newspaper written, edited and published by students at Bur Oak Secondary School. Our job is to tell our school community what is happening, why it matters, and what people are saying about it, accurately and fairly.',
    ],
  ],
  [
    'Independence',
    [
      'Students make every editorial decision: what we cover, what we publish and what we leave out. Teachers, staff advisers, sponsors and the people we write about do not approve stories before publication. We listen to concerns, but the editors decide.',
      'We follow school policy and the law. When a story could raise a question about either, the editor-in-chief decides, after talking to our adviser if needed.',
    ],
  ],
  [
    'Accuracy',
    [
      'Every story is checked by an editor before it is published. We confirm names, titles, dates, numbers and quotes with the people involved or with records. When we cannot confirm something, we say so or leave it out.',
      'We do not make up quotes, people or events, and we do not publish rumours as fact.',
    ],
  ],
  [
    'Corrections',
    [
      'When we get something wrong, we fix it and say so. Corrections appear at the end of the story with the date they were made, and we never quietly change a published fact. To report a mistake, use the “Spotted a mistake?” link under any story or our contact page.',
    ],
  ],
  [
    'Sources',
    [
      'We name our sources whenever we can. We grant anonymity only when a person could face real harm for speaking, the information matters to readers and we cannot get it any other way. At least one editor must know who the source is, and we explain in the story why the person was not named.',
      'Our reporters identify themselves as BOSS Today reporters and tell people when they are speaking on the record.',
    ],
  ],
  [
    'Fairness',
    [
      'People who are criticized in a story get a reasonable chance to respond before it is published, and we include their response. We keep news and opinion separate: opinion pieces are labelled, and they are the views of their writers, not of BOSS Today.',
    ],
  ],
  [
    'Privacy',
    [
      'Most of the people we write about are students and minors. We think carefully before naming a student in connection with discipline, health, family matters or anything else that could follow them, and we do not publish personal contact information.',
    ],
  ],
  [
    'Conflicts of interest',
    [
      'Reporters do not cover clubs, teams or events they lead or are closely involved in, or stories about close friends and family. If a conflict cannot be avoided, we tell readers in the story.',
    ],
  ],
  [
    'Photos and AI',
    [
      'Photos show what happened: we may crop and adjust brightness, but we do not add, remove or move anything. Illustrations and photo illustrations are labelled. We do not publish text or images made by AI tools as reporting.',
    ],
  ],
  [
    'Contact us',
    ['Questions, concerns or tips? Use our contact page. Editors read every message.'],
  ],
]

export const defaultStandards = {
  root: {
    ...node,
    type: 'root',
    children: SECTIONS.flatMap(([heading, paragraphs]) => [h2(heading), ...paragraphs.map(p)]),
  },
}
