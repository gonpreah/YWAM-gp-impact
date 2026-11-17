/* My YWAM GP — teams.html: Tests (Nov 2026, Uriah).
   "A lot of tests … can we make a test section." ☰ → Tests (S.view='tests'), and a tile in About me.
   One page that lists every test: Personality and Strengths (their own screens, unchanged), the
   Language level test (Learn Khmer), and two new ones, both YWAM GP's own:
   - 🔥 Fivefold gifts (APEST, Ephesians 4:11): 30 statements, 1–5, scored on the server
     (saveMyApest, api.js APEST_ITEMS — the test checks the page's order matches). Alan Hirsch's
     APEST / 5Q test is his; nothing of it is copied. Results: the five as bars, the top two
     explained; shared with the team like Strengths (a teammate sees the top two only).
   - 💍 Couple check-up: for pre-marriage counselling and married couples. PREPARE/ENRICH is a
     licensed assessment through a certified facilitator, so this is our own: 40 statements in ten
     areas, each partner on their own; one partner starts it and names the other and, if they
     like, a counsellor. Results only once both have answered: each area, and every statement as
     a strength, something to talk about, or something to grow in. Only the two of them and their
     counsellor ever see it (mcList / mcStart / mcAnswer / mcSetCounselor / mcDelete).
   The questions are data with English and Khmer side by side (like OO_VALUES), read through lx_;
   the page's own words go through t(). */
S.tests={ sub:'home', mc:null, mcLoading:false, mcErr:'', mcOpen:null, mcNew:null, mcAns:null, apAns:null, busy:false };
function lx_(o){ return o ? (LANG==='km' && o.km ? o.km : o.en) : ''; }

/* ---------------- the fivefold gifts ---------------- */
var APEST_GIFTS={
  a:{ emoji:'🧭', name:{en:'Apostle',km:'សាវក'}, short:{en:'The pioneer',km:'អ្នកត្រួសត្រាយ'},
    is:{en:'You are drawn to start new things and to go where the church is not yet. You see the big picture and how the parts can work together, and you build teams and ways of working so the mission keeps growing.',
        km:'អ្នកចូលចិត្តចាប់ផ្តើមរឿងថ្មីៗ ហើយទៅកន្លែងដែលមិនទាន់មានក្រុមជំនុំ។ អ្នកមើលឃើញរូបភាពធំ និងរបៀបដែលផ្នែកនីមួយៗអាចធ្វើការរួមគ្នា ហើយអ្នកកសាងក្រុម និងរបៀបធ្វើការ ដើម្បីឲ្យបេសកកម្មបន្តរីកចម្រើន។'},
    gives:{en:'Vision, courage to try, new places reached, and structures that last after you move on.',
        km:'ចក្ខុវិស័យ ភាពក្លាហានក្នុងការសាកល្បង ការទៅដល់កន្លែងថ្មីៗ និងរចនាសម្ព័ន្ធដែលនៅស្ថិតស្ថេរ ទោះបីអ្នកចាកចេញទៅហើយក៏ដោយ។'},
    watch:{en:'Moving on before others are ready, and forgetting the people while chasing the next thing.',
        km:'ការបន្តទៅមុខ មុនពេលអ្នកដទៃត្រៀមខ្លួនរួច និងការភ្លេចមនុស្ស ខណៈដែលកំពុងដេញតាមរឿងបន្ទាប់។'} },
  p:{ emoji:'🔥', name:{en:'Prophet',km:'ហោរា'}, short:{en:'The listener',km:'អ្នកស្តាប់ព្រះ'},
    is:{en:'You are tuned to what God is saying and to whether our life matches it. You notice when something is off, you care that our faith is real, and you call people back to God.',
        km:'អ្នកផ្ចង់ចិត្តទៅលើអ្វីដែលព្រះកំពុងមានបន្ទូល និងថាតើជីវិតរបស់យើងស្របនឹងបន្ទូលនោះឬទេ។ អ្នកកត់សម្គាល់ឃើញ ពេលមានអ្វីមិនត្រឹមត្រូវ អ្នកយកចិត្តទុកដាក់ថា ជំនឿរបស់យើងពិតប្រាកដ ហើយអ្នកហៅមនុស្សឲ្យត្រឡប់មករកព្រះវិញ។'},
    gives:{en:'Prayer, honesty, faithfulness to God’s call, and a team that stays close to him.',
        km:'ការអធិស្ឋាន ភាពស្មោះត្រង់ ភាពស្មោះត្រង់ចំពោះការត្រាស់ហៅរបស់ព្រះ និងក្រុមដែលនៅជិតស្និទ្ធនឹងទ្រង់។'},
    watch:{en:'Speaking truth without love, and being so sure of what you hear that you stop listening to others.',
        km:'ការនិយាយសេចក្តីពិតដោយគ្មានសេចក្តីស្រឡាញ់ និងការប្រាកដពេកលើអ្វីដែលអ្នកឮ រហូតឈប់ស្តាប់អ្នកដទៃ។'} },
  e:{ emoji:'📣', name:{en:'Evangelist',km:'អ្នកផ្សាយដំណឹងល្អ'}, short:{en:'The messenger',km:'អ្នកនាំសារ'},
    is:{en:'You love people who do not know Jesus yet, and you find it natural to tell them about him. You make friends outside the church easily and you pull the team outward.',
        km:'អ្នកស្រឡាញ់មនុស្សដែលមិនទាន់ស្គាល់ព្រះយេស៊ូវ ហើយអ្នកងាយនឹងប្រាប់ពួកគេអំពីទ្រង់។ អ្នកងាយរាប់អានមិត្តភក្តិនៅក្រៅក្រុមជំនុំ ហើយអ្នកនាំក្រុមឲ្យចេញទៅខាងក្រៅ។'},
    gives:{en:'People hearing the good news, new believers, and a church that remembers why it exists.',
        km:'មនុស្សបានឮដំណឹងល្អ អ្នកជឿថ្មី និងក្រុមជំនុំដែលចងចាំថា ហេតុអ្វីបានជាខ្លួនមាន។'},
    watch:{en:'Leaving new believers without care, and pushing others to share faith the way you do.',
        km:'ការទុកអ្នកជឿថ្មីចោលដោយគ្មានការថែទាំ និងការជំរុញអ្នកដទៃឲ្យចែកចាយជំនឿតាមរបៀបដូចអ្នក។'} },
  s:{ emoji:'🤲', name:{en:'Shepherd',km:'គ្រូគង្វាល'}, short:{en:'The carer',km:'អ្នកថែទាំ'},
    is:{en:'You notice people and you stay with them. You care for the hurting, make people feel they belong, and help them heal and grow over time.',
        km:'អ្នកកត់សម្គាល់មនុស្ស ហើយអ្នកនៅជាមួយពួកគេ។ អ្នកថែទាំអ្នកដែលឈឺចាប់ ធ្វើឲ្យមនុស្សមានអារម្មណ៍ថាពួកគេជាផ្នែកមួយ ហើយជួយពួកគេឲ្យជាសះស្បើយ និងលូតលាស់តាមពេលវេលា។'},
    gives:{en:'Belonging, safety, healing and a community where nobody is forgotten.',
        km:'ភាពជាផ្នែកមួយ សុវត្ថិភាព ការជាសះស្បើយ និងសហគមន៍ដែលគ្មាននរណាម្នាក់ត្រូវគេភ្លេច។'},
    watch:{en:'Avoiding hard change to keep everyone comfortable, and carrying what is not yours to carry.',
        km:'ការជៀសវាងការផ្លាស់ប្តូរដ៏ពិបាក ដើម្បីឲ្យមនុស្សគ្រប់គ្នាស្រួល និងការលីសែងបន្ទុកដែលមិនមែនជារបស់អ្នក។'} },
  t:{ emoji:'📖', name:{en:'Teacher',km:'គ្រូបង្រៀន'}, short:{en:'The explainer',km:'អ្នកពន្យល់'},
    is:{en:'You love God’s Word and you love to help others understand it. You explain clearly, step by step, and you help people live by what they learn.',
        km:'អ្នកស្រឡាញ់ព្រះបន្ទូល ហើយអ្នកចូលចិត្តជួយអ្នកដទៃឲ្យយល់ព្រះបន្ទូល។ អ្នកពន្យល់យ៉ាងច្បាស់ មួយជំហានម្តងៗ ហើយអ្នកជួយមនុស្សឲ្យរស់នៅតាមអ្វីដែលពួកគេរៀន។'},
    gives:{en:'Understanding, sound teaching, and people who can feed themselves from the Bible.',
        km:'ការយល់ដឹង ការបង្រៀនត្រឹមត្រូវ និងមនុស្សដែលអាចចិញ្ចឹមខ្លួនឯងពីព្រះគម្ពីរ។'},
    watch:{en:'Knowing more than you live, and making faith only about ideas.',
        km:'ការដឹងច្រើនជាងអ្វីដែលអ្នករស់នៅ និងការធ្វើឲ្យជំនឿគ្រាន់តែជាគំនិត។'} }
};
var APEST_ORDER=['a','p','e','s','t'];
/* The statements, in the order the server scores them (api.js APEST_ITEMS — each one's gift). */
var APEST_QS=[
  ['a',{en:'I love starting something new where nothing exists yet.',km:'ខ្ញុំចូលចិត្តចាប់ផ្តើមរឿងថ្មីមួយ នៅកន្លែងដែលមិនទាន់មានអ្វីសោះ។'}],
  ['p',{en:'I notice quickly when something in a group is not right with God or with each other.',km:'ខ្ញុំកត់សម្គាល់ឃើញភ្លាមៗ ពេលមានអ្វីមួយក្នុងក្រុមមិនត្រឹមត្រូវជាមួយព្រះ ឬជាមួយគ្នាទៅវិញទៅមក។'}],
  ['e',{en:'I find it easy to talk about Jesus with people who don’t know him.',km:'ខ្ញុំងាយនឹងនិយាយអំពីព្រះយេស៊ូវ ជាមួយមនុស្សដែលមិនស្គាល់ទ្រង់។'}],
  ['s',{en:'People often come to me when they are hurting.',km:'មនុស្សច្រើនតែមករកខ្ញុំ ពេលពួកគេឈឺចាប់។'}],
  ['t',{en:'I enjoy studying a subject until I can explain it clearly.',km:'ខ្ញុំចូលចិត្តសិក្សាប្រធានបទមួយ រហូតដល់ខ្ញុំអាចពន្យល់វាបានច្បាស់។'}],
  ['p',{en:'I often sense what God is saying to a person or a group.',km:'ខ្ញុំច្រើនតែដឹងក្នុងចិត្តថា ព្រះកំពុងមានបន្ទូលអ្វីទៅកាន់មនុស្សម្នាក់ ឬក្រុមមួយ។'}],
  ['a',{en:'I keep thinking about where the team should be in a few years.',km:'ខ្ញុំតែងតែគិតអំពីកន្លែងដែលក្រុមគួរតែទៅដល់ ក្នុងរយៈពេលពីរបីឆ្នាំខាងមុខ។'}],
  ['t',{en:'When someone is confused, I want to help them understand step by step.',km:'ពេលនរណាម្នាក់ច្រឡំ ខ្ញុំចង់ជួយពួកគេឲ្យយល់ មួយជំហានម្តងៗ។'}],
  ['e',{en:'I get excited when someone new comes to faith.',km:'ខ្ញុំរំភើបចិត្ត ពេលមានមនុស្សថ្មីមកជឿព្រះ។'}],
  ['s',{en:'I notice when someone on the team is left out or quiet.',km:'ខ្ញុំកត់សម្គាល់ឃើញ ពេលមាននរណាម្នាក់ក្នុងក្រុមត្រូវគេទុកចោល ឬស្ងៀមស្ងាត់។'}],
  ['e',{en:'I make friends easily with people outside the church.',km:'ខ្ញុំងាយរាប់អានមិត្តភក្តិ ជាមួយមនុស្សនៅក្រៅក្រុមជំនុំ។'}],
  ['s',{en:'I would rather care for a few people well than lead a big crowd.',km:'ខ្ញុំចូលចិត្តថែទាំមនុស្សពីរបីនាក់ឲ្យបានល្អ ជាជាងដឹកនាំហ្វូងមនុស្សធំ។'}],
  ['a',{en:'I am happy to take risks to reach a new place or people group.',km:'ខ្ញុំសុខចិត្តប្រថុយ ដើម្បីទៅដល់កន្លែងថ្មី ឬក្រុមមនុស្សថ្មី។'}],
  ['p',{en:'I am willing to say a hard truth, even when it is not welcome.',km:'ខ្ញុំសុខចិត្តនិយាយសេចក្តីពិតដែលពិបាកស្តាប់ ទោះបីគេមិនចង់ឮក៏ដោយ។'}],
  ['t',{en:'I check whether what is taught matches the Bible.',km:'ខ្ញុំពិនិត្យមើលថា តើអ្វីដែលគេបង្រៀនស្របនឹងព្រះគម្ពីរឬទេ។'}],
  ['s',{en:'I stay with people through a hard season, even when it is slow.',km:'ខ្ញុំនៅជាមួយមនុស្សក្នុងរដូវកាលដ៏លំបាក ទោះបីវាយឺតក៏ដោយ។'}],
  ['t',{en:'I like to prepare lessons, notes or studies that others can use.',km:'ខ្ញុំចូលចិត្តរៀបចំមេរៀន កំណត់ត្រា ឬការសិក្សា ដែលអ្នកដទៃអាចប្រើបាន។'}],
  ['p',{en:'I care a lot that our worship and our lives are real, not just for show.',km:'ខ្ញុំយកចិត្តទុកដាក់ខ្លាំងថា ការថ្វាយបង្គំ និងជីវិតរបស់យើងគឺពិតប្រាកដ មិនមែនគ្រាន់តែសម្រាប់បង្ហាញទេ។'}],
  ['a',{en:'I like building teams and systems so the work can grow without me.',km:'ខ្ញុំចូលចិត្តកសាងក្រុម និងប្រព័ន្ធ ដើម្បីឲ្យការងារអាចរីកចម្រើន ទោះបីគ្មានខ្ញុំក៏ដោយ។'}],
  ['e',{en:'I look for ways to bring people who don’t know God to what we do.',km:'ខ្ញុំរកវិធីនាំមនុស្សដែលមិនស្គាល់ព្រះ ឲ្យមកចូលរួមក្នុងអ្វីដែលយើងធ្វើ។'}],
  ['t',{en:'I enjoy helping people learn to read and use the Bible for themselves.',km:'ខ្ញុំចូលចិត្តជួយមនុស្សឲ្យរៀនអាន និងប្រើព្រះគម្ពីរដោយខ្លួនឯង។'}],
  ['e',{en:'I tell people what God has done in my life, even people I have just met.',km:'ខ្ញុំប្រាប់មនុស្សអំពីអ្វីដែលព្រះបានធ្វើក្នុងជីវិតខ្ញុំ សូម្បីតែមនុស្សដែលខ្ញុំទើបតែជួប។'}],
  ['s',{en:'I make sure the people around me feel they belong.',km:'ខ្ញុំធ្វើឲ្យប្រាកដថា មនុស្សនៅជុំវិញខ្ញុំមានអារម្មណ៍ថា ពួកគេជាផ្នែកមួយនៃក្រុម។'}],
  ['p',{en:'I spend long times in prayer, listening for God’s direction.',km:'ខ្ញុំចំណាយពេលយូរក្នុងការអធិស្ឋាន ដើម្បីស្តាប់ការដឹកនាំរបស់ព្រះ។'}],
  ['a',{en:'I get restless when things stay the same for too long.',km:'ខ្ញុំអន្ទះសា ពេលអ្វីៗនៅដដែលយូរពេក។'}],
  ['a',{en:'I can see how different ministries could work together toward one goal.',km:'ខ្ញុំអាចមើលឃើញថា កិច្ចការបម្រើផ្សេងៗអាចធ្វើការរួមគ្នា ឆ្ពោះទៅគោលដៅតែមួយ។'}],
  ['p',{en:'I speak up when we drift from what God has called us to do.',km:'ខ្ញុំនិយាយឡើង ពេលយើងរសាត់ចេញពីអ្វីដែលព្រះបានត្រាស់ហៅយើងឲ្យធ្វើ។'}],
  ['e',{en:'I often think about people who have never heard the good news.',km:'ខ្ញុំច្រើនតែគិតអំពីមនុស្សដែលមិនដែលបានឮដំណឹងល្អ។'}],
  ['s',{en:'I enjoy having people in my home, sharing meals and making them feel welcome.',km:'ខ្ញុំចូលចិត្តទទួលមនុស្សមកផ្ទះ ហូបបាយជាមួយគ្នា និងធ្វើឲ្យពួកគេមានអារម្មណ៍ថាត្រូវគេស្វាគមន៍។'}],
  ['t',{en:'I like to explain the why behind what we believe and do.',km:'ខ្ញុំចូលចិត្តពន្យល់ពីមូលហេតុនៅពីក្រោយអ្វីដែលយើងជឿ និងធ្វើ។'}]
];
var APEST_SCALE=[[1,{en:'Not like me',km:'មិនដូចខ្ញុំ'}],[2,{en:'A little',km:'បន្តិច'}],[3,{en:'Sometimes',km:'ពេលខ្លះ'}],[4,{en:'Mostly',km:'ភាគច្រើន'}],[5,{en:'Very like me',km:'ដូចខ្ញុំណាស់'}]];
var APEST_DRAFT='gp-apest-draft';
function myApest_(){ return (S.profile && S.profile.apest) || null; }
function apestName_(g){ var x=APEST_GIFTS[g]; return x ? x.emoji+' '+lx_(x.name) : ''; }

/* ---------------- the couple check-up ---------------- */
var MC_AREAS=[
  ['comm','💬',{en:'Talking and listening',km:'ការនិយាយ និងការស្តាប់'},{en:'When do you feel most heard by each other? When do you feel least heard?',km:'តើពេលណាដែលអ្នកមានអារម្មណ៍ថា គ្នាទៅវិញទៅមកស្តាប់អ្នកច្រើនបំផុត? ពេលណាតិចបំផុត?'}],
  ['conflict','🤝',{en:'Disagreements',km:'ការមិនយល់ស្របគ្នា'},{en:'Think of your last disagreement. What helped, and what made it worse?',km:'គិតអំពីការមិនយល់ស្របគ្នាចុងក្រោយរបស់អ្នក។ តើអ្វីបានជួយ ហើយអ្វីធ្វើឲ្យកាន់តែអាក្រក់?'}],
  ['money','💵',{en:'Money',km:'លុយកាក់'},{en:'What did money look like in each of your families growing up? What do you want to keep or change?',km:'កាលនៅតូច តើលុយកាក់ក្នុងគ្រួសាររបស់អ្នកនីមួយៗយ៉ាងដូចម្តេច? តើអ្នកចង់រក្សា ឬផ្លាស់ប្តូរអ្វីខ្លះ?'}],
  ['home','🏠',{en:'Home and roles',km:'ផ្ទះ និងតួនាទី'},{en:'Who will do what at home? How will you decide when you disagree?',km:'តើនរណានឹងធ្វើអ្វីនៅផ្ទះ? តើអ្នកនឹងសម្រេចចិត្តដោយរបៀបណា ពេលមិនយល់ស្របគ្នា?'}],
  ['family','👨‍👩‍👧',{en:'Our families',km:'គ្រួសាររបស់យើង'},{en:'What do your parents expect of you once you are married? How will you honour them and still put your marriage first?',km:'តើឪពុកម្តាយរបស់អ្នករំពឹងអ្វីពីអ្នក ពេលអ្នករៀបការរួច? តើអ្នកនឹងគោរពពួកគាត់ ហើយនៅតែដាក់អាពាហ៍ពិពាហ៍ជាមុនដោយរបៀបណា?'}],
  ['faith','🙏',{en:'Faith together',km:'ជំនឿជាមួយគ្នា'},{en:'How will you pray, read the Bible and serve God together, not only side by side?',km:'តើអ្នកនឹងអធិស្ឋាន អានព្រះគម្ពីរ និងបម្រើព្រះជាមួយគ្នាដោយរបៀបណា មិនមែនគ្រាន់តែនៅក្បែរគ្នា?'}],
  ['intimacy','❤️',{en:'Affection and intimacy',km:'ការស្រឡាញ់ និងភាពស្និទ្ធស្នាល'},{en:'What makes you feel loved? What helps you feel safe to talk about this?',km:'តើអ្វីធ្វើឲ្យអ្នកមានអារម្មណ៍ថាត្រូវគេស្រឡាញ់? តើអ្វីជួយឲ្យអ្នកមានអារម្មណ៍សុវត្ថិភាព ក្នុងការនិយាយអំពីរឿងនេះ?'}],
  ['children','👶',{en:'Children',km:'កូន'},{en:'When, how many, and how will you raise them — and in which language and culture?',km:'តើពេលណា ប៉ុន្មាននាក់ ហើយអ្នកនឹងចិញ្ចឹមពួកគេដោយរបៀបណា — ហើយជាភាសា និងវប្បធម៌ណា?'}],
  ['future','🧭',{en:'Calling and the future',km:'ការត្រាស់ហៅ និងអនាគត'},{en:'Where do you see yourselves in five years? How will ministry and marriage share your time?',km:'តើអ្នកឃើញខ្លួនឯងនៅឯណា ក្នុងរយៈពេលប្រាំឆ្នាំទៀត? តើកិច្ចការបម្រើ និងអាពាហ៍ពិពាហ៍នឹងចែកពេលវេលារបស់អ្នកដោយរបៀបណា?'}],
  ['friend','😄',{en:'Friendship and fun',km:'មិត្តភាព និងការសប្បាយ'},{en:'What do you most enjoy doing together? When did you last do it?',km:'តើអ្នកចូលចិត្តធ្វើអ្វីជាមួយគ្នាជាងគេ? តើអ្នកបានធ្វើវាចុងក្រោយនៅពេលណា?'}]
];
/* Forty statements, four for each area in order; the server checks there are MC_N (api.js). */
var MC_QS=[
  ['comm',{en:'I feel listened to when I share something that matters to me.',km:'ខ្ញុំមានអារម្មណ៍ថាត្រូវគេស្តាប់ ពេលខ្ញុំចែកចាយរឿងដែលសំខាន់សម្រាប់ខ្ញុំ។'}],
  ['comm',{en:'We can talk about our feelings openly.',km:'យើងអាចនិយាយអំពីអារម្មណ៍របស់យើងដោយបើកចំហ។'}],
  ['comm',{en:'My partner understands me well.',km:'ដៃគូរបស់ខ្ញុំយល់ពីខ្ញុំបានល្អ។'}],
  ['comm',{en:'I find it easy to tell my partner what I need.',km:'ខ្ញុំងាយនឹងប្រាប់ដៃគូរបស់ខ្ញុំ ពីអ្វីដែលខ្ញុំត្រូវការ។'}],
  ['conflict',{en:'When we disagree, we talk it through calmly.',km:'ពេលយើងមិនយល់ស្របគ្នា យើងនិយាយគ្នាដោយស្ងប់ស្ងាត់។'}],
  ['conflict',{en:'We say sorry and forgive each other quickly.',km:'យើងសុំទោស និងអត់ទោសឲ្យគ្នាទៅវិញទៅមកយ៉ាងឆាប់។'}],
  ['conflict',{en:'Our arguments do not leave lasting hurt.',km:'ការឈ្លោះប្រកែករបស់យើង មិនបន្សល់ទុកនូវការឈឺចាប់យូរអង្វែងទេ។'}],
  ['conflict',{en:'We solve problems together, as a team.',km:'យើងដោះស្រាយបញ្ហាជាមួយគ្នា ដូចជាក្រុមមួយ។'}],
  ['money',{en:'We agree on how to spend and save money.',km:'យើងយល់ស្របគ្នាអំពីរបៀបចាយ និងសន្សំលុយ។'}],
  ['money',{en:'We are open with each other about what we earn, owe and give.',km:'យើងបើកចំហជាមួយគ្នា អំពីអ្វីដែលយើងរកបាន ជំពាក់ និងឲ្យ។'}],
  ['money',{en:'We have a plan for living on support or on a salary.',km:'យើងមានផែនការសម្រាប់ការរស់នៅដោយការគាំទ្រ ឬដោយប្រាក់ខែ។'}],
  ['money',{en:'We agree on how much to give to God and to our families.',km:'យើងយល់ស្របគ្នាថា តើត្រូវថ្វាយព្រះ និងជួយគ្រួសាររបស់យើងប៉ុន្មាន។'}],
  ['home',{en:'We agree on who does which jobs at home.',km:'យើងយល់ស្របគ្នាថា តើនរណាធ្វើការងារអ្វីនៅផ្ទះ។'}],
  ['home',{en:'We share the work at home in a way that feels fair to both of us.',km:'យើងចែកការងារនៅផ្ទះ តាមរបៀបដែលយើងទាំងពីរមានអារម្មណ៍ថាយុត្តិធម៌។'}],
  ['home',{en:'We agree on how decisions are made in our home.',km:'យើងយល់ស្របគ្នាអំពីរបៀបសម្រេចចិត្តនៅក្នុងផ្ទះរបស់យើង។'}],
  ['home',{en:'I respect the way my partner does things, even when it is different from me.',km:'ខ្ញុំគោរពរបៀបដែលដៃគូរបស់ខ្ញុំធ្វើអ្វីៗ ទោះបីវាខុសពីខ្ញុំក៏ដោយ។'}],
  ['family',{en:'We agree on how much time to spend with each other’s families.',km:'យើងយល់ស្របគ្នាថា តើត្រូវចំណាយពេលប៉ុន្មានជាមួយគ្រួសាររបស់គ្នាទៅវិញទៅមក។'}],
  ['family',{en:'We agree on how much to help our families with money.',km:'យើងយល់ស្របគ្នាថា តើត្រូវជួយគ្រួសាររបស់យើងផ្នែកលុយកាក់ប៉ុន្មាន។'}],
  ['family',{en:'I feel accepted by my partner’s family.',km:'ខ្ញុំមានអារម្មណ៍ថា គ្រួសាររបស់ដៃគូខ្ញុំទទួលយកខ្ញុំ។'}],
  ['family',{en:'We put our marriage first, even when our families want something else.',km:'យើងដាក់អាពាហ៍ពិពាហ៍របស់យើងជាមុន ទោះបីគ្រួសាររបស់យើងចង់បានអ្វីផ្សេងក៏ដោយ។'}],
  ['faith',{en:'We pray together.',km:'យើងអធិស្ឋានជាមួយគ្នា។'}],
  ['faith',{en:'We share the same beliefs about God and the Bible.',km:'យើងមានជំនឿដូចគ្នាអំពីព្រះ និងព្រះគម្ពីរ។'}],
  ['faith',{en:'We agree about our calling and our part in ministry.',km:'យើងយល់ស្របគ្នាអំពីការត្រាស់ហៅ និងចំណែករបស់យើងក្នុងកិច្ចការបម្រើ។'}],
  ['faith',{en:'My partner helps me grow closer to God.',km:'ដៃគូរបស់ខ្ញុំជួយខ្ញុំឲ្យកាន់តែជិតស្និទ្ធនឹងព្រះ។'}],
  ['intimacy',{en:'I feel loved and cared for by my partner.',km:'ខ្ញុំមានអារម្មណ៍ថា ដៃគូរបស់ខ្ញុំស្រឡាញ់ និងយកចិត្តទុកដាក់លើខ្ញុំ។'}],
  ['intimacy',{en:'We can talk openly about affection and sex.',km:'យើងអាចនិយាយដោយបើកចំហអំពីការបង្ហាញក្តីស្រឡាញ់ និងការរួមភេទ។'}],
  ['intimacy',{en:'We agree on the boundaries for our physical relationship.',km:'យើងយល់ស្របគ្នាអំពីព្រំដែនសម្រាប់ទំនាក់ទំនងខាងរូបកាយរបស់យើង។'}],
  ['intimacy',{en:'I feel safe and respected with my partner.',km:'ខ្ញុំមានអារម្មណ៍សុវត្ថិភាព និងត្រូវគេគោរព នៅពេលនៅជាមួយដៃគូរបស់ខ្ញុំ។'}],
  ['children',{en:'We agree on whether and when to have children.',km:'យើងយល់ស្របគ្នាថា តើគួរមានកូនឬអត់ ហើយនៅពេលណា។'}],
  ['children',{en:'We agree on how to teach and correct children.',km:'យើងយល់ស្របគ្នាអំពីរបៀបបង្រៀន និងកែតម្រូវកូន។'}],
  ['children',{en:'We agree on the schooling, language and culture our children will grow up in.',km:'យើងយល់ស្របគ្នាអំពីការសិក្សា ភាសា និងវប្បធម៌ដែលកូនរបស់យើងនឹងធំឡើងនៅក្នុងនោះ។'}],
  ['children',{en:'We agree on how to balance children and ministry.',km:'យើងយល់ស្របគ្នាអំពីរបៀបរក្សាតុល្យភាពរវាងកូន និងកិច្ចការបម្រើ។'}],
  ['future',{en:'We agree on where we want to live in the coming years.',km:'យើងយល់ស្របគ្នាអំពីកន្លែងដែលយើងចង់រស់នៅ ក្នុងប៉ុន្មានឆ្នាំខាងមុខ។'}],
  ['future',{en:'We have talked about what we each expect marriage to be like.',km:'យើងបាននិយាយគ្នាអំពីអ្វីដែលយើងម្នាក់ៗរំពឹងថា អាពាហ៍ពិពាហ៍នឹងទៅជាយ៉ាងណា។'}],
  ['future',{en:'We agree on how much time goes to ministry and how much to each other.',km:'យើងយល់ស្របគ្នាថា តើពេលវេលាប៉ុន្មានសម្រាប់កិច្ចការបម្រើ ហើយប៉ុន្មានសម្រាប់គ្នាទៅវិញទៅមក។'}],
  ['future',{en:'I feel confident about our future together.',km:'ខ្ញុំមានទំនុកចិត្តលើអនាគតរបស់យើងជាមួយគ្នា។'}],
  ['friend',{en:'We enjoy spending free time together.',km:'យើងចូលចិត្តចំណាយពេលទំនេរជាមួយគ្នា។'}],
  ['friend',{en:'We laugh together often.',km:'យើងសើចជាមួយគ្នាជាញឹកញាប់។'}],
  ['friend',{en:'My partner is a close friend to me.',km:'ដៃគូរបស់ខ្ញុំជាមិត្តជិតស្និទ្ធរបស់ខ្ញុំ។'}],
  ['friend',{en:'We have friends and mentors who support our relationship.',km:'យើងមានមិត្តភក្តិ និងអ្នកណែនាំ ដែលគាំទ្រទំនាក់ទំនងរបស់យើង។'}]
];
var MC_SCALE=[[1,{en:'Not true',km:'មិនពិត'}],[2,{en:'A little true',km:'ពិតបន្តិច'}],[3,{en:'Partly',km:'ពិតខ្លះ'}],[4,{en:'Mostly true',km:'ពិតភាគច្រើន'}],[5,{en:'Very true',km:'ពិតណាស់'}]];
var MC_STAGES=[['dating','Dating'],['engaged','Engaged'],['married','Married']];
function mcArea_(id){ return MC_AREAS.filter(function(a){ return a[0]===id; })[0]; }
/* A statement, once both have answered: both 4+ → a strength; 2 or more apart → talk about it; else
   (both 3 or less) → something to grow in together. */
function mcKind_(x, y){ if(Math.abs(x-y)>=2) return 'talk'; if(x>=4 && y>=4) return 'strength'; if(x<=3 && y<=3) return 'grow'; return 'ok'; }
function mcResult_(r){
  var A=r.answers.a, B=r.answers.b, areas=MC_AREAS.map(function(a){ return { id:a[0], sum:0, n:0, items:[] }; });
  MC_QS.forEach(function(q, i){
    var x=Number(A['q'+i]), y=Number(B['q'+i]), ar=areas.filter(function(z){ return z.id===q[0]; })[0];
    ar.sum+=x+y; ar.n+=2; ar.items.push({ i:i, a:x, b:y, kind:mcKind_(x,y) });
  });
  areas.forEach(function(ar){ ar.pct=Math.round((ar.sum/ar.n-1)/4*100); });
  return areas;
}

/* ---------------- loading, saving ---------------- */
function mcLoad_(force){
  var T=S.tests; if(T.mcLoading || (T.mc && !force)) return;
  T.mcLoading=true; T.mcErr='';
  run('mcList',[S.auth.user,S.auth.pin],function(d){ T.mcLoading=false; if(d && d.ok){ T.mc=d.list||[]; } else T.mcErr=t('Could not load'); if(S.view==='tests') render(); },
    function(){ T.mcLoading=false; T.mcErr=t('Could not load'); if(S.view==='tests') render(); });
}
function mcTake_(d, after){
  var T=S.tests; T.busy=false;
  if(!d || !d.ok){
    var why={ bad_partner:t('Pick your partner from the list.'), bad_counselor:t('Pick someone else as your counsellor.'), too_many:t('You already have three check-ups waiting to be finished.'), incomplete:t('Answer every statement first.') }[d && d.err];
    showMsg(why || t('Could not save — check your connection and try again.')); render(); return;
  }
  T.mc=d.list||[]; if(after) after(d); render(); window.scrollTo(0,0);
}
function apestSave_(payload, then){
  S.tests.busy=true;
  run('saveMyApest',[S.auth.user,S.auth.pin,payload],function(d){
    S.tests.busy=false;
    if(!d || !d.ok){ showMsg(d && d.err==='incomplete' ? t('Answer every statement first.') : t('Could not save — check your connection and try again.')); render(); return; }
    S.profile=Object.assign({}, S.profile||{}, { apest:d.apest });
    (S.roster||[]).forEach(function(r){ if(r.id===S.me.id){ if(d.staff && d.staff.apest) r.apest=d.staff.apest; else delete r.apest; } });
    if(then) then(d); render(); window.scrollTo(0,0);
  }, function(){ S.tests.busy=false; showMsg(t('Could not save — check your connection and try again.')); render(); });
}
function testsOpen_(sub){ S.view='tests'; S.tests.sub=sub||'home'; render(); window.scrollTo(0,0); }

/* ---------------- the page ---------------- */
function testsHtml_(){
  var T=S.tests;
  if(T.sub==='apest') return apestTestHtml_();
  if(T.sub==='apestres') return apestResHtml_();
  if(T.sub==='mcnew') return mcNewHtml_();
  if(T.sub==='mcans') return mcAnsHtml_();
  if(T.sub==='mcres') return mcResHtml_();
  mcLoad_();
  var h='<button class="linkbtn" style="text-align:left;text-decoration:none;padding-left:0" id="testsBack">← '+esc(t('My Home'))+'</button>'+
    '<h2 style="margin:6px 0 2px">🧪 '+esc(t('Tests'))+'</h2>'+
    '<p class="sub" style="margin:0 0 12px">'+esc(t('Get to know how God made you, and the people you do life with.'))+'</p>';
  var tile=function(id, icon, title, sub, done){ return '<button class="card testRow" id="'+id+'"><span class="testIcon">'+icon+'</span>'+
    '<span style="flex:1;min-width:0"><span class="testTitle">'+esc(title)+'</span><span class="testSub">'+sub+'</span></span>'+
    (done ? '<span class="testDone">✓</span>' : '')+PCHEV+'</button>'; };
  h+='<h3>'+esc(t('About you'))+'</h3>';
  if(pOK()){ var p=myPType(); h+=tile(p?'pSeeMine':'pStart', '🧭', t('Personality'), esc(p ? p.type+' · '+pTheName(p.type) : t('40 quick statements · about 5 minutes')), !!p); }
  if(gsOK()){ var g=myGS(); h+=tile(g?'gsSeeMine':'gsStart', '💪', t('Strengths'), g ? '<span class="sChips homeTileChips">'+g.top.map(function(id,i){ return gsChipHtml(id,i+1); }).join('')+'</span>' : esc(t('Find your top 5 strengths')), !!g); }
  var ap=myApest_();
  h+=tile('testApest', '🔥', t('Fivefold gifts (APEST)'), esc(ap ? ap.top.slice(0,2).map(apestName_).join(' · ') : t('30 statements · about 5 minutes')), !!ap);
  h+=tile('testLang', '🗣️', t('Language level test'), esc(t('Khmer or English — where you are, and what to learn next')), !!(S.me && S.me.langLevel && S.me.langLevel.latest));
  h+='<h3>💍 '+esc(t('Couple check-up'))+'</h3>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(t('For couples getting ready for marriage, and for married couples. Each of you answers on your own; then you see together where you are strong and what to talk about. Only the two of you, and a counsellor if you choose one, ever see it.'))+'</p>';
  if(T.mcLoading && !T.mc) h+='<div class="card sub">'+esc(t('Loading…'))+'</div>';
  else if(T.mcErr && !T.mc) h+='<div class="card"><p class="sub">'+esc(T.mcErr)+'</p><button class="btn ghost" id="mcRetry">'+esc(t('Try again'))+'</button></div>';
  else {
    (T.mc||[]).forEach(function(r){ h+=mcRowHtml_(r); });
    h+='<button class="btn" id="mcStartNew" style="margin-top:6px">＋ '+esc(t('Start a couple check-up'))+'</button>';
  }
  h+='<p class="pmeta" style="margin-top:16px">'+esc(t('These tests are YWAM GP’s own. They are not the official MBTI®, PREPARE/ENRICH or APEST assessments.'))+'</p>';
  return '<div id="testsPage">'+h+'</div>';
}
function mcOther_(r){ var me=S.me.id; return r.role==='counselor' ? null : (r.a && r.a.id===me ? r.b : r.a); }
function mcMineDone_(r){ var me=S.me.id; return (r.a && r.a.id===me && r.doneA) || (r.b && r.b.id===me && r.doneB); }
function mcRowHtml_(r){
  var me=S.me.id, other=mcOther_(r), line, act='';
  var stage=t((MC_STAGES.filter(function(x){ return x[0]===r.stage; })[0]||['','Engaged'])[1]);
  var title = r.role==='counselor' ? gpT('{a} & {b}',{a:firstName_(r.a&&r.a.name), b:firstName_(r.b&&r.b.name)}) : gpT('With {name}',{name:(other&&other.name)||''});
  if(r.both){ line=t('You have both answered — see your results'); act='<button class="btn" data-mcres="'+esc(r.id)+'">'+esc(t('See the results'))+'</button>'; }
  else if(r.role==='counselor'){ line=gpT('{n} of 2 have answered',{n:(r.doneA?1:0)+(r.doneB?1:0)}); }
  else if(mcMineDone_(r)){ line=gpT('Waiting for {name} to answer',{name:firstName_(other&&other.name)}); act='<button class="btn ghost" data-mcans="'+esc(r.id)+'">'+esc(t('Change my answers'))+'</button>'; }
  else { line=t('Your turn — answer the 40 statements'); act='<button class="btn" data-mcans="'+esc(r.id)+'">'+esc(t('Answer now'))+'</button>'; }
  var counsel = r.counselor ? (r.role==='counselor' ? t('You are their counsellor') : gpT('Counsellor: {name}',{name:r.counselor.name})) : (r.role==='counselor' ? '' : t('No counsellor yet'));
  return '<div class="card mcRow" data-mcrow="'+esc(r.id)+'"><div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><b style="font-size:15px">'+esc(title)+'</b><span class="pill">'+esc(stage)+'</span></div>'+
    '<div class="pmeta" style="margin:4px 0">'+esc(line)+(counsel?' · '+esc(counsel):'')+'</div>'+(act?'<div style="display:flex;gap:8px;flex-wrap:wrap">'+act+'</div>':'')+'</div>';
}

/* ---- the fivefold gifts: test and results ---- */
function apestTestHtml_(){
  var T=S.tests; if(!T.apAns){ try{ T.apAns=JSON.parse(localStorage.getItem(APEST_DRAFT)||'null')||{}; }catch(e){ T.apAns={}; } }
  var A=T.apAns, n=Object.keys(A).length;
  var h='<button class="linkbtn" style="text-align:left;text-decoration:none;padding-left:0" id="testsHome">← '+esc(t('Tests'))+'</button>'+
    '<h2 style="margin:6px 0 2px">🔥 '+esc(t('Fivefold gifts (APEST)'))+'</h2>'+
    '<p class="sub" style="margin:0 0 6px">'+esc(t('Ephesians 4:11–13 names five gifts Jesus gave his church — apostles, prophets, evangelists, shepherds and teachers — to build up his people. Every one of us carries something of all five, and most of us lean towards one or two.'))+'</p>'+
    '<p class="sub" style="margin:0 0 10px">'+esc(t('Answer as you really are, not as you wish you were.'))+'</p>'+
    '<div class="testProg"><span style="width:'+Math.round(n/APEST_QS.length*100)+'%"></span></div><div class="pmeta" id="apProg">'+gpT('{n} of {total}',{n:n,total:APEST_QS.length})+'</div>';
  APEST_QS.forEach(function(q, i){
    h+='<div class="card testQ'+(A['q'+i]?' done':'')+'" id="apQ'+i+'"><div class="testQText">'+(i+1)+'. '+esc(lx_(q[1]))+'</div><div class="testScale">'+
      APEST_SCALE.map(function(s){ return '<button class="testOpt'+(A['q'+i]===s[0]?' on':'')+'" data-apq="'+i+'|'+s[0]+'">'+esc(lx_(s[1]))+'</button>'; }).join('')+'</div></div>';
  });
  h+='<button class="btn" id="apSubmit"'+(n<APEST_QS.length||T.busy?' disabled':'')+'>'+esc(T.busy?t('Saving…'):t('See my gifts'))+'</button>';
  return '<div id="apestTest">'+h+'</div>';
}
function apestResHtml_(){
  var ap=myApest_();
  var h='<button class="linkbtn" style="text-align:left;text-decoration:none;padding-left:0" id="testsHome">← '+esc(t('Tests'))+'</button>';
  if(!ap) return h+'<p class="sub">'+esc(t('You haven’t taken this test yet.'))+'</p><button class="btn" id="apRetake">'+esc(t('Take the test'))+'</button>';
  h+='<h2 style="margin:6px 0 10px">🔥 '+esc(t('Your fivefold gifts'))+'</h2><div class="card" id="apBars">';
  APEST_ORDER.slice().sort(function(x,y){ return ap.top.indexOf(x)-ap.top.indexOf(y); }).forEach(function(g){
    var v=ap.scores[g]||0, top=ap.top.indexOf(g)<2;
    h+='<div class="apBar'+(top?' top':'')+'"><div class="apBarHead"><span>'+esc(apestName_(g))+'</span><b>'+v+'%</b></div><div class="apTrack"><span style="width:'+Math.max(2,v)+'%"></span></div></div>';
  });
  h+='</div>';
  ap.top.slice(0,2).forEach(function(g, i){
    var x=APEST_GIFTS[g];
    h+='<div class="card apGift"><div class="pmeta">'+esc(i===0?t('Your strongest gift'):t('Your second gift'))+'</div>'+
      '<h3 style="margin:2px 0 6px">'+x.emoji+' '+esc(lx_(x.name))+' · <span class="sub">'+esc(lx_(x.short))+'</span></h3>'+
      '<p style="margin:0 0 8px">'+esc(lx_(x.is))+'</p>'+
      '<p style="margin:0 0 6px"><b>'+esc(t('What you bring:'))+'</b> '+esc(lx_(x.gives))+'</p>'+
      '<p style="margin:0"><b>'+esc(t('Watch out for:'))+'</b> '+esc(lx_(x.watch))+'</p></div>';
  });
  h+='<p class="sub">'+esc(t('No gift is better than another. A healthy team needs all five, so notice who on your team is strong where you are not.'))+'</p>'+
    '<div class="card"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="apShare"'+(ap.share?' checked':'')+'> '+esc(t('Show my top two gifts to the team'))+'</label></div>'+
    '<button class="btn ghost" id="apRetake">'+esc(t('Take it again'))+'</button>';
  return '<div id="apestRes">'+h+'</div>';
}

/* ---- the couple check-up: start, answer, results ---- */
function mcPeople_(exclude){
  return (S.roster||[]).filter(function(p){ return exclude.indexOf(p.id)===-1; })
    .sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); })
    .map(function(p){ return { id:p.id, name:p.name, sub:t(p.ministry||p.dept||''), first:p.campus===S.me.campus, group:'' }; });
}
function mcNewHtml_(){
  var N=S.tests.mcNew||(S.tests.mcNew={ partner:'', counselor:'', stage:'engaged' });
  var h='<button class="linkbtn" style="text-align:left;text-decoration:none;padding-left:0" id="testsHome">← '+esc(t('Tests'))+'</button>'+
    '<h2 style="margin:6px 0 10px">💍 '+esc(t('Start a couple check-up'))+'</h2>';
  h+='<div class="card"><label class="f">'+esc(t('Who is your partner?'))+'</label>'+
    ppickHtml_({ key:'mcPartner', people:mcPeople_([S.me.id, N.counselor]), chosen:N.partner?[N.partner]:[], placeholder:t('Type their name…'),
      onPick:function(id){ N.partner=id; render(); }, onRemove:function(){ N.partner=''; render(); } })+
    '<p class="pmeta" style="margin:6px 0 0">'+esc(t('They need a profile in the app. They will be asked to answer too.'))+'</p></div>';
  h+='<div class="card"><label class="f">'+esc(t('Where are you now?'))+'</label><div class="testScale">'+
    MC_STAGES.map(function(s){ return '<button class="testOpt'+(N.stage===s[0]?' on':'')+'" data-mcstage="'+s[0]+'">'+esc(t(s[1]))+'</button>'; }).join('')+'</div></div>';
  h+='<div class="card"><label class="f">'+esc(t('A counsellor (optional)'))+'</label>'+
    '<p class="pmeta" style="margin:0 0 6px">'+esc(t('Someone who walks with you through pre-marriage or marriage counselling. They will see your results once you have both answered.'))+'</p>'+
    ppickHtml_({ key:'mcCounsel', people:mcPeople_([S.me.id, N.partner]), chosen:N.counselor?[N.counselor]:[], placeholder:t('Type their name…'),
      onPick:function(id){ N.counselor=id; render(); }, onRemove:function(){ N.counselor=''; render(); } })+'</div>';
  h+='<button class="btn" id="mcCreate"'+(!N.partner||S.tests.busy?' disabled':'')+'>'+esc(S.tests.busy?t('Saving…'):t('Start and answer my part'))+'</button>';
  return '<div id="mcNew">'+h+'</div>';
}
function mcAnsHtml_(){
  var T=S.tests, r=(T.mc||[]).filter(function(x){ return x.id===T.mcOpen; })[0];
  var h='<button class="linkbtn" style="text-align:left;text-decoration:none;padding-left:0" id="testsHome">← '+esc(t('Tests'))+'</button>';
  if(!r) return h+'<p class="sub">'+esc(t('Could not load'))+'</p>';
  if(!T.mcAns) T.mcAns=Object.assign({}, r.mine||{});
  var A=T.mcAns, n=Object.keys(A).length, other=mcOther_(r);
  h+='<h2 style="margin:6px 0 2px">💍 '+esc(t('Couple check-up'))+'</h2>'+
    '<p class="sub" style="margin:0 0 6px">'+esc(gpT('Answer on your own, honestly — not what you think {name} will say. They won’t see your answers until you have both finished.',{name:firstName_(other&&other.name)}))+'</p>'+
    '<div class="testProg"><span style="width:'+Math.round(n/MC_QS.length*100)+'%"></span></div><div class="pmeta" id="mcProg">'+gpT('{n} of {total}',{n:n,total:MC_QS.length})+'</div>';
  var last='';
  MC_QS.forEach(function(q, i){
    if(q[0]!==last){ var ar=mcArea_(q[0]); h+='<h3 style="margin:14px 0 6px">'+ar[1]+' '+esc(lx_(ar[2]))+'</h3>'; last=q[0]; }
    h+='<div class="card testQ'+(A['q'+i]?' done':'')+'" id="mcQ'+i+'"><div class="testQText">'+esc(lx_(q[1]))+'</div><div class="testScale">'+
      MC_SCALE.map(function(s){ return '<button class="testOpt'+(A['q'+i]===s[0]?' on':'')+'" data-mcq="'+i+'|'+s[0]+'">'+esc(lx_(s[1]))+'</button>'; }).join('')+'</div></div>';
  });
  h+='<button class="btn" id="mcSubmit"'+(n<MC_QS.length||T.busy?' disabled':'')+'>'+esc(T.busy?t('Saving…'):t('Send my answers'))+'</button>';
  return '<div id="mcAns">'+h+'</div>';
}
function mcResHtml_(){
  var T=S.tests, r=(T.mc||[]).filter(function(x){ return x.id===T.mcOpen; })[0];
  var h='<button class="linkbtn" style="text-align:left;text-decoration:none;padding-left:0" id="testsHome">← '+esc(t('Tests'))+'</button>';
  if(!r || !r.both) return h+'<p class="sub">'+esc(t('Could not load'))+'</p>';
  var an=firstName_(r.a.name), bn=firstName_(r.b.name), areas=mcResult_(r);
  var count=function(k){ return areas.reduce(function(s,ar){ return s+ar.items.filter(function(x){ return x.kind===k; }).length; },0); };
  h+='<h2 style="margin:6px 0 2px">💍 '+esc(gpT('{a} & {b}',{a:an,b:bn}))+'</h2>'+
    '<p class="sub" style="margin:0 0 10px">'+esc(t('This is a place to start talking, not a grade. Go through it together — with your counsellor if you have one.'))+'</p>'+
    '<div class="mcTiles"><div class="mcTile ok"><b>'+count('strength')+'</b><span>'+esc(t('Strengths'))+'</span></div>'+
    '<div class="mcTile talk"><b>'+count('talk')+'</b><span>'+esc(t('To talk about'))+'</span></div>'+
    '<div class="mcTile grow"><b>'+count('grow')+'</b><span>'+esc(t('To grow in'))+'</span></div></div>';
  h+='<div class="card" id="mcAreas">'+areas.map(function(ar){ var m=mcArea_(ar.id);
    return '<div class="apBar"><div class="apBarHead"><span>'+m[1]+' '+esc(lx_(m[2]))+'</span><b>'+ar.pct+'%</b></div><div class="apTrack"><span style="width:'+Math.max(2,ar.pct)+'%"></span></div></div>'; }).join('')+'</div>';
  var mark={ strength:['✓', t('Strength')], talk:['💬', t('Talk about it')], grow:['🌱', t('Grow in it')], ok:['', ''] };
  areas.forEach(function(ar){
    var m=mcArea_(ar.id);
    h+='<details class="card mcArea" data-mcarea="'+ar.id+'"'+(ar.items.some(function(x){ return x.kind==='talk'; })?' open':'')+'><summary><b>'+m[1]+' '+esc(lx_(m[2]))+'</b> <span class="pmeta">'+ar.pct+'%</span></summary>'+
      ar.items.map(function(x){ var k=mark[x.kind];
        return '<div class="mcItem '+x.kind+'"><div>'+esc(lx_(MC_QS[x.i][1]))+'</div><div class="pmeta">'+esc(an)+': '+esc(lx_(MC_SCALE[x.a-1][1]))+' · '+esc(bn)+': '+esc(lx_(MC_SCALE[x.b-1][1]))+(k[0]?' · <b>'+k[0]+' '+esc(k[1])+'</b>':'')+'</div></div>'; }).join('')+
      '<div class="mcTalk"><b>'+esc(t('Talk together:'))+'</b> '+esc(lx_(m[3]))+'</div></details>';
  });
  if(r.role!=='counselor'){
    h+='<div class="card"><label class="f">'+esc(t('Counsellor'))+'</label>'+
      ppickHtml_({ key:'mcCounselSet', people:mcPeople_([r.a.id, r.b.id]), chosen:r.counselor?[r.counselor.id]:[], placeholder:t('Type their name…'),
        onPick:function(id){ S.tests.busy=true; run('mcSetCounselor',[S.auth.user,S.auth.pin,r.id,id],function(d){ mcTake_(d); }); },
        onRemove:function(){ run('mcSetCounselor',[S.auth.user,S.auth.pin,r.id,''],function(d){ mcTake_(d); }); } })+'</div>'+
      '<button class="btn ghost" data-mcans="'+esc(r.id)+'">'+esc(t('Change my answers'))+'</button> '+
      '<button class="btn ghost" id="mcDelete">'+esc(t('Delete this check-up'))+'</button>';
  }
  return '<div id="mcRes">'+h+'</div>';
}

/* ---------------- binding ---------------- */
function bindTests_(){
  var T=S.tests, on=function(id, f){ var e=document.getElementById(id); if(e) e.onclick=f; };
  on('testsTile', function(){ gpTap(); T.mc=null; testsOpen_('home'); });
  if(S.view!=='tests') return;
  on('testsBack', function(){ S.view='week'; render(); window.scrollTo(0,0); });
  on('testsHome', function(){ T.mcAns=null; testsOpen_('home'); });
  on('mcRetry', function(){ mcLoad_(true); });
  on('testApest', function(){ testsOpen_(myApest_() ? 'apestres' : 'apest'); });
  on('apRetake', function(){ T.apAns={}; testsOpen_('apest'); });
  on('testLang', function(){ if(typeof khOpen_==='function'){ khOpen_(); if(S.kh){ S.kh.area='test'; } render(); } });
  on('mcStartNew', function(){ T.mcNew=null; testsOpen_('mcnew'); });
  document.querySelectorAll('[data-apq]').forEach(function(b){ b.onclick=function(){
    var v=b.getAttribute('data-apq').split('|'); T.apAns['q'+v[0]]=Number(v[1]);
    try{ localStorage.setItem(APEST_DRAFT, JSON.stringify(T.apAns)); }catch(e){}
    var y=window.scrollY; render(); window.scrollTo(0,y);
  }; });
  on('apSubmit', function(){ apestSave_({ answers:T.apAns }, function(){ try{ localStorage.removeItem(APEST_DRAFT); }catch(e){} T.apAns=null; T.sub='apestres'; if(typeof gpConfetti==='function') gpConfetti(); }); });
  var sh=document.getElementById('apShare'); if(sh) sh.onchange=function(){ apestSave_({ share:sh.checked }); };
  document.querySelectorAll('[data-mcstage]').forEach(function(b){ b.onclick=function(){ T.mcNew.stage=b.getAttribute('data-mcstage'); render(); }; });
  on('mcCreate', function(){ var N=T.mcNew; if(!N.partner) return; T.busy=true; render();
    run('mcStart',[S.auth.user,S.auth.pin,{ partnerId:N.partner, counselorId:N.counselor, stage:N.stage }],function(d){ mcTake_(d, function(dd){ T.mcOpen=dd.id; T.mcAns={}; T.sub='mcans'; }); }); });
  document.querySelectorAll('[data-mcans]').forEach(function(b){ b.onclick=function(){ T.mcOpen=b.getAttribute('data-mcans'); T.mcAns=null; testsOpen_('mcans'); }; });
  document.querySelectorAll('[data-mcres]').forEach(function(b){ b.onclick=function(){ T.mcOpen=b.getAttribute('data-mcres'); testsOpen_('mcres'); }; });
  document.querySelectorAll('[data-mcq]').forEach(function(b){ b.onclick=function(){
    var v=b.getAttribute('data-mcq').split('|'); T.mcAns['q'+v[0]]=Number(v[1]);
    var y=window.scrollY; render(); window.scrollTo(0,y);
  }; });
  on('mcSubmit', function(){ T.busy=true; render();
    run('mcAnswer',[S.auth.user,S.auth.pin,T.mcOpen,T.mcAns],function(d){ mcTake_(d, function(){ T.mcAns=null; var r=(T.mc||[]).filter(function(x){ return x.id===T.mcOpen; })[0]; T.sub = r && r.both ? 'mcres' : 'home'; if(r && r.both && typeof gpConfetti==='function') gpConfetti(); }); }); });
  on('mcDelete', function(){ if(!confirm(t('Delete this check-up and both sets of answers? This can’t be undone.'))) return;
    run('mcDelete',[S.auth.user,S.auth.pin,T.mcOpen],function(d){ mcTake_(d, function(){ T.sub='home'; T.mcOpen=null; }); }); });
  if(typeof bindPeoplePick_==='function') bindPeoplePick_();
}
