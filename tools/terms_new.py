"""Replace old Korean anatomical terms (구용어) with the new terms (신용어) in game text and docs, fixing the following
particle when the final consonant changes (e.g. 견봉은 -> 봉우리는, 기시를 -> 이는곳을).
usage: python3 tools/terms_new.py <files...>   (prints a per-file count)
"""
import re, sys

# longest / most specific first
MAP = [
    # muscles & parts
    ('내외측축', '안쪽가쪽축'), ('상완이두근건막', '위팔두갈래근널힘줄'), ('삼각근조면', '어깨세모근거친면'), ('삼각흉근고랑', '어깨세모가슴근고랑'),
    ('상완이두근', '위팔두갈래근'), ('상완삼두근', '위팔세갈래근'), ('상완요골근', '위팔노근'), ('오훼완근', '부리위팔근'),
    ('삼각근', '어깨세모근'), ('대흉근', '큰가슴근'), ('소흉근', '작은가슴근'), ('극상근', '가시위근'), ('극하근', '가시아래근'),
    ('소원근', '작은원근'), ('대원근', '큰원근'), ('견갑하근', '어깨밑근'), ('광배근', '넓은등근'), ('원회내근', '원엎침근'),
    ('방형회내근', '네모엎침근'), ('회외근', '뒤침근'), ('전거근', '앞톱니근'), ('승모근', '등세모근'), ('회전근개', '돌림근띠'),
    ('상완근', '위팔근'),
    ('외측두', '가쪽갈래'), ('내측두', '안쪽갈래'), ('장두', '긴갈래'), ('단두', '짧은갈래'), ('쇄골두', '빗장부분'), ('흉늑부', '복장갈비부분'),
    ('굴곡건', '굽힘힘줄'),
    # nerves
    ('근피신경', '근육피부신경'), ('액와신경', '겨드랑신경'), ('요골신경', '노신경'), ('척골신경', '자신경'), ('견갑상신경', '어깨위신경'),
    ('흉배신경', '가슴등신경'), ('흉근신경', '가슴근신경'),
    # joints
    ('견갑상완리듬', '어깨위팔리듬'), ('견갑상완관절', '오목위팔관절'), ('견갑흉곽관절', '어깨가슴관절'), ('견갑흉곽', '어깨가슴'),
    ('견쇄관절', '봉우리빗장관절'), ('흉쇄관절', '복장빗장관절'), ('완척관절', '위팔자관절'), ('완요관절', '위팔노관절'),
    ('요골손목관절', '노손목관절'), ('구관절', '절구관절'), ('관절와순', '관절테두리'), ('관절낭', '관절주머니'),
    # landmarks
    ('외측과상능선', '가쪽관절융기위능선'), ('내측상과', '안쪽위관절융기'), ('외측상과', '가쪽위관절융기'),
    ('관절상결절', '관절위결절'), ('관절하결절', '관절아래결절'), ('대결절', '큰결절'), ('소결절', '작은결절'), ('결절간구', '결절사이고랑'),
    ('외측순', '가쪽입술'), ('내측순', '안쪽입술'), ('요골조면', '노뼈거친면'), ('척골조면', '자뼈거친면'),
    ('오구돌기', '부리돌기'), ('구상돌기', '갈고리돌기'), ('경상돌기', '붓돌기'), ('극돌기', '가시돌기'),
    ('활차절흔', '도르래패임'), ('활차', '도르래'), ('주두', '팔꿈치머리'), ('극상와', '가시위오목'), ('극하와', '가시아래오목'),
    ('견갑극', '어깨뼈가시'), ('견봉', '봉우리'), ('관절와', '관절오목'), ('흉요근막', '등허리근막'), ('장골능', '엉덩뼈능선'),
    # bones
    ('상완골두', '위팔뼈머리'), ('요골두', '노뼈머리'), ('소두', '작은머리'), ('상완골', '위팔뼈'), ('견갑골', '어깨뼈'), ('쇄골', '빗장뼈'),
    ('요골', '노뼈'), ('척골', '자뼈'), ('흉골병', '복장뼈자루'), ('흉골', '복장뼈'), ('늑연골', '갈비연골'), ('늑골', '갈비뼈'),
    ('흉곽', '가슴우리'), ('흉추', '등뼈'), ('비골', '종아리뼈'), ('대퇴골', '넙다리뼈'), ('경골', '정강뼈'),
    ('상지대', '팔이음뼈'), ('상지', '팔'), ('하지', '다리'), ('상완', '위팔'), ('전완', '아래팔'),
    # concepts / directions / movements
    ('기시정지', '이는곳·닿는곳'), ('기시점', '이는곳'), ('정지점', '닿는곳'),
    ('기시부', '이는곳'), ('정지부', '닿는곳'), ('기시', '이는곳'), ('정지', '닿는곳'),
    ('주동근', '주작용근'), ('길항근', '대항근'), ('협력근', '협동근'),
    ('근위부', '몸쪽부분'), ('원위부', '먼쪽부분'), ('근위', '몸쪽'), ('원위', '먼쪽'), ('외측', '가쪽'), ('내측', '안쪽'),
    ('외회전', '가쪽돌림'), ('내회전', '안쪽돌림'), ('외전', '벌림'), ('내전', '모음'), ('굴곡', '굽힘'), ('신전', '폄'),
    ('회내', '엎침'), ('회외', '뒤침'),
]
# words that contain an old term but must not change
KEEP = ['일시정지', '일시 정지', '정지 화면', '정지 포즈', '정지 상태', '외과목', '관여하지', '필요하지', '지지하지', '하지 않', '모두']

PARTICLES = [('이에요', '예요'), ('으로', '로'), ('이며', '며'), ('이고', '고'), ('이나', '나'), ('이다', '다'), ('이라', '라'), ('이란', '란'),
             ('이면', '면'), ('은', '는'), ('이', '가'), ('을', '를'), ('과', '와')]

def batchim(ch):
    o = ord(ch) - 0xAC00
    return None if not (0 <= o < 11172) else o % 28      # 0 = no final consonant, 8 = ㄹ

def particle_for(new, p_cons, p_vow):
    b = batchim(new[-1])
    if p_cons == '으로': return '로' if b in (0, 8) else '으로'
    return p_cons if b else p_vow

HANGUL = re.compile('[가-힣]')

def convert(text):
    n = 0
    protect = {}
    for i, k in enumerate(KEEP):
        tok = f'\x00K{i}\x00'; protect[tok] = k; text = text.replace(k, tok)
    for old, new in MAP:
        out = []; i = 0
        while True:
            j = text.find(old, i)
            if j < 0: out.append(text[i:]); break
            out.append(text[i:j]); k = j + len(old); rep = new
            # particle right after the term (and ending the word)
            # only a particle that is grammatical after the OLD term (consonant- or vowel-form), and only rewritten
            # when the final sound changes (otherwise e.g. 외측면 'lateral surface' would be read as 외측+면)
            ob, nb = batchim(old[-1]), batchim(new[-1])
            if bool(ob) != bool(nb) or (ob == 8) != (nb == 8):
                for pc, pv in PARTICLES:
                    form = (('로' if ob == 8 else pc) if pc == '으로' else pc) if ob else pv
                    if text.startswith(form, k) and not (k + len(form) < len(text) and HANGUL.match(text[k + len(form)])):
                        rep = new + particle_for(new, pc, pv); k += len(form); break
            out.append(rep); i = k; n += 1
        text = ''.join(out)
    for tok, k in protect.items(): text = text.replace(tok, k)
    return text, n

if __name__ == '__main__':
    tot = 0
    for f in sys.argv[1:]:
        s = open(f, encoding='utf-8').read(); t, n = convert(s)
        if n: open(f, 'w', encoding='utf-8').write(t); print(f'{n:4d}  {f}'); tot += n
    print('total', tot)
