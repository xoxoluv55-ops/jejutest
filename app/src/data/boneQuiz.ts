// Bone identification check (v0.6): before a bone is recovered the player must pick the feature that is true of it.
// Every wrong option is a real feature of a different bone that is easy to confuse with it (radius vs ulna, clavicle
// vs scapula ...), so a mistake still teaches a correct fact. Basic: name shown, correct + first wrong option.
// Advanced: name hidden, correct + both wrong options.
import type { BoneId } from './anatomy';

export interface BoneQuiz {
  correct: string;
  wrong: { text: string; is: string }[];   // `is` = which bone the statement really describes (shown after a miss)
  why: string;                              // short explanation shown after a miss / on success
}

export const BONE_QUIZ: Record<BoneId, BoneQuiz> = {
  radius: {
    correct: '몸쪽 끝(노뼈머리)은 작은 원반 모양이고 먼쪽 끝은 넓다. 해부학적 자세에서 엄지 쪽(가쪽)에 있다.',
    wrong: [
      { text: '몸쪽 끝이 크고(팔꿈치머리·도르래패임) 먼쪽 끝은 작다. 새끼손가락 쪽(안쪽)에 있다.', is: '자뼈' },
      { text: '다리 가쪽에 있는 가늘고 긴 뼈로, 먼쪽 끝이 가쪽복사를 이룬다.', is: '종아리뼈' },
    ],
    why: '노뼈는 몸쪽이 작고 먼쪽이 넓다 — 자뼈와 반대. 먼쪽 끝이 손목관절의 대부분을 이룬다.',
  },
  ulna: {
    correct: '몸쪽 끝이 크다(팔꿈치머리·도르래패임) — 위팔뼈 도르래와 팔꿉관절을 이룬다. 새끼손가락 쪽(안쪽)에 있다.',
    wrong: [
      { text: '몸쪽 끝(머리)은 작고 먼쪽 끝은 넓다. 엄지 쪽(가쪽)에 있다.', is: '노뼈' },
      { text: '몸쪽 끝의 둥근 머리가 어깨뼈 관절오목과 관절한다.', is: '위팔뼈' },
    ],
    why: '자뼈는 몸쪽이 크고(팔꿈치 뒤에서 만져지는 팔꿈치머리) 먼쪽이 작다 — 노뼈와 반대.',
  },
  humerus: {
    correct: '몸쪽 끝의 둥근 머리가 어깨뼈 관절오목과 만나 오목위팔관절을 이룬다. 먼쪽 끝에는 도르래와 작은머리가 있다.',
    wrong: [
      { text: '몸쪽 끝에 팔꿈치머리가 있어 팔꿈치 뒤쪽에서 만져진다.', is: '자뼈' },
      { text: '팔의 뼈 중 유일하게 몸통 뼈대(복장뼈)와 직접 관절을 이룬다.', is: '빗장뼈' },
    ],
    why: '위팔뼈 = 위팔의 긴뼈. 몸쪽 머리는 어깨뼈와, 먼쪽 도르래는 자뼈와, 작은머리는 노뼈와 관절한다.',
  },
  clavicle: {
    correct: 'S자로 휜 뼈. 안쪽 끝은 복장뼈와(복장빗장관절), 가쪽 끝은 어깨뼈 봉우리와(봉우리빗장관절) 관절한다.',
    wrong: [
      { text: '넓고 납작한 삼각형 뼈로, 가쪽각의 관절오목이 위팔뼈머리를 받는다.', is: '어깨뼈' },
      { text: '위팔의 긴뼈로, 몸쪽 끝에 둥근 머리가 있다.', is: '위팔뼈' },
    ],
    why: '빗장뼈는 팔(팔이음뼈)과 몸통 뼈대를 잇는 유일한 뼈 연결(복장빗장관절)이다.',
  },
  scapula: {
    correct: '납작한 삼각형 뼈. 가쪽각의 관절오목이 위팔뼈머리를 받고, 뒷면의 어깨뼈가시가 봉우리로 이어진다.',
    wrong: [
      { text: 'S자로 휜 긴 뼈로, 안쪽 끝이 복장뼈와 관절한다.', is: '빗장뼈' },
      { text: '아래팔 가쪽의 뼈로, 먼쪽 끝이 넓다.', is: '노뼈' },
    ],
    why: '어깨뼈는 몸통 뼈대와 직접 관절하지 않고(근육으로 붙어 있음), 봉우리로 빗장뼈와 관절한다.',
  },
  fibula: {
    correct: '다리(종아리) 가쪽의 가늘고 긴 뼈 — 팔뼈대가 아니다. 먼쪽 끝이 가쪽복사를 이룬다.',
    wrong: [
      { text: '아래팔 안쪽의 뼈로, 몸쪽 끝에 팔꿈치머리가 있다.', is: '자뼈' },
      { text: '아래팔 가쪽의 뼈로, 몸쪽 머리는 작고 먼쪽 끝이 넓다.', is: '노뼈' },
    ],
    why: '종아리뼈는 노뼈·자뼈처럼 가늘고 길지만 다리의 뼈다. 팔꿉관절이 없다 — 조립 때 폐기 대상.',
  },
};
