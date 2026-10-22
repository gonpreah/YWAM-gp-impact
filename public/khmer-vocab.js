/* Learn Khmer — the words of "KBC Vocabulary" by Phy Chum and Andrew Potter, as the app's flashcards.
   Loaded on demand by the Learn Khmer page (teams/15-khmer.js), like library.js.
   Three levels (the book's three sections), each a set of word lists; a word is [english, khmer]
   or [english, khmer, note]. Keep the book's order inside a list. */
var GP_KHMER_VOCAB = {
  levels: [
    { id: 0, name: 'The script', blurb: 'The 33 consonants in their two series, the vowels and the independent vowels — the letters before the words.' },
    { id: 1, name: 'Essentials', blurb: 'Numbers, time, family, the verbs you use every day — the words everything else is built on.' },
    { id: 2, name: 'Daily life', blurb: 'Home, the market, the city, YWAM life, the restaurant, the hospital.' },
    { id: 3, name: 'Deeper talk', blurb: 'Small talk that goes somewhere — work, weather, faith, history — and the words of the Bible.' }
  ],
  cats: [
    /* the script (script: true — a card shows the letter first; the sound is the answer). A consonant's
       sound is given with its series: first-series consonants carry an "a" sound, second-series an "o". */
    { id: 'consonants', level: 0, script: true, name: 'Consonants', tip: 'Each consonant belongs to one of two series, and the series decides how the vowel after it sounds: first series (a), second series (o).', words: [
      ['kâ · first series', 'ក'], ['khâ · first series', 'ខ'], ['kô · second series', 'គ'], ['khô · second series', 'ឃ'], ['ngô · second series', 'ង'],
      ['châ · first series', 'ច'], ['chhâ · first series', 'ឆ'], ['chô · second series', 'ជ'], ['chhô · second series', 'ឈ'], ['nhô · second series', 'ញ'],
      ['dâ · first series', 'ដ'], ['thâ · first series', 'ឋ'], ['dô · second series', 'ឌ'], ['thô · second series', 'ឍ'], ['nâ · first series', 'ណ'],
      ['tâ · first series', 'ត'], ['thâ · first series (t)', 'ថ'], ['tô · second series', 'ទ'], ['thô · second series (t)', 'ធ'], ['nô · second series', 'ន'],
      ['bâ · first series', 'ប'], ['phâ · first series', 'ផ'], ['pô · second series', 'ព'], ['phô · second series', 'ភ'], ['mô · second series', 'ម'],
      ['yô · second series', 'យ'], ['rô · second series', 'រ'], ['lô · second series', 'ល'], ['vô · second series', 'វ'],
      ['sâ · first series', 'ស'], ['hâ · first series', 'ហ'], ['lâ · first series', 'ឡ'], ['’â · first series', 'អ']
    ] },
    { id: 'vowels', level: 0, script: true, name: 'Vowels', tip: 'A vowel sign attaches to a consonant and sounds one way after a first-series consonant, another after a second-series one: first / second.', words: [
      ['a / ie', '◌ា'], ['e / i', '◌ិ'], ['ei / i', '◌ី'], ['œ / œ', '◌ឹ'], ['œ / œu', '◌ឺ'], ['o / u', '◌ុ'], ['ou / u', '◌ូ'], ['uo / uo', '◌ួ'], ['aeu / eu', '◌ើ'], ['eua / eua', '◌ឿ'], ['ie / ie', '◌ៀ'],
      ['ei / e', '◌េ'], ['ae / ê', '◌ែ'], ['ai / ey', '◌ៃ'], ['ao / ou', '◌ោ'], ['au / ov', '◌ៅ'], ['om / um', '◌ុំ'], ['am / um', '◌ំ'], ['am / oam', '◌ាំ'], ['ah / eah', '◌ះ'],
      ['eh / ih', '◌ិះ'], ['oh / uh', '◌ុះ'], ['eh / ih (e)', '◌េះ'], ['aoh / uoh', '◌ោះ']
    ] },
    { id: 'indvowels', level: 0, script: true, name: 'Independent vowels', tip: 'These stand on their own, without a consonant.', words: [
      ['e', 'ឥ'], ['ei', 'ឦ'], ['o', 'ឧ'], ['ou', 'ឩ'], ['au', 'ឪ'], ['rœ', 'ឫ'], ['rœu', 'ឬ'], ['lœ', 'ឭ'], ['lœu', 'ឮ'], ['ae', 'ឯ'], ['ai', 'ឰ'], ['ao', 'ឱ'], ['ao (ឲ)', 'ឲ'], ['au (ឳ)', 'ឳ']
    ] },
    { id: 'numbers', level: 1, name: 'Numbers', words: [
      ['1', 'មួយ', '១'], ['2', 'ពីរ', '២'], ['3', 'បី', '៣'], ['4', 'បួន', '៤'], ['5', 'ប្រាំ', '៥'], ['6', 'ប្រាំមួយ', '៦'], ['7', 'ប្រាំពីរ', '៧'], ['8', 'ប្រាំបី', '៨'], ['9', 'ប្រាំបួន', '៩'], ['10', 'ដប់', '១០'],
      ['20', 'ម្ភៃ', '២០'], ['30', 'សាមសិប', '៣០'], ['40', 'សែសិប', '៤០'], ['50', 'ហាសិប', '៥០'], ['60', 'ហុកសិប', '៦០'], ['70', 'ចិតសិប', '៧០'], ['80', 'ប៉ែតសិប', '៨០'], ['90', 'កៅសិប', '៩០'],
      ['100', 'មួយរយ', '១០០'], ['1,000', 'មួយពាន់', '១០០០'], ['10,000', 'មួយម៉ឺន'], ['100,000', 'មួយសែន'], ['1,000,000', 'មួយលាន'], ['0', 'សូន្យ', '០']
    ] },
    { id: 'prepositions', level: 1, name: 'Prepositions', words: [
      ['At / side', 'នៅ / ខាង'], ['In', 'ក្នុង'], ['Out', 'ក្រៅ'], ['On / above', 'ខាងលើ'], ['Forward', 'ទៅមុខ'], ['Left', 'ខាងឆ្វេង'], ['Right', 'ខាងស្តាំ'],
      ['Front', 'ខាងមុខ'], ['Behind', 'ខាងក្រោយ'], ['Below', 'ខាងក្រោម'], ['Near', 'នៅជិត'], ['Beside', 'នៅក្បែរ'], ['Close', 'នៅក្បែរ'],
      ['Around', 'ជុំវិញ'], ['Among', 'ក្នុងចំណោម'], ['This', 'នេះ'], ['That', 'នោះ'], ['Here', 'នៅទីនេះ'], ['There', 'នៅទីនោះ']
    ] },
    { id: 'colors', level: 1, name: 'Colours', words: [
      ['White', 'ពណ៌ស'], ['Black', 'ពណ៌ខ្មៅ'], ['Green', 'ពណ៌បៃតង'], ['Brown', 'ពណ៌ត្នោត'], ['Red', 'ពណ៌ក្រហម'], ['Blue', 'ពណ៌ខៀវ'], ['Yellow', 'ពណ៌លឿង'], ['Gray', 'ពណ៌ប្រផេះ'],
      ['Purple', 'ពណ៌ស្វាយ'], ['Orange', 'ពណ៌ទឹកក្រូច'], ['Pink', 'ពណ៌ផ្កាឈូក']
    ] },
    { id: 'time', level: 1, name: 'Time', words: [
      ['Time', 'ពេលវេលា'], ['Before', 'ពីមុន'], ['Now', 'ឥឡូវនេះ'], ['Later', 'ពេលក្រោយ'], ['Yesterday', 'ម្សិលមិញ'], ['Today', 'ថ្ងៃនេះ'], ['Tomorrow', 'ថ្ងៃស្អែក'],
      ['Past', 'អតីតកាល'], ['Present', 'បច្ចុប្បន្ន'], ['Future', 'អនាគត'], ['Second', 'វិនាទី'], ['Minute', 'នាទី'], ['Hour', 'ម៉ោង'], ['Day', 'ថ្ងៃ'], ['Week', 'សប្តាហ៍ / អាទិត្យ'], ['Weekend', 'ចុងសប្តាហ៍'], ['Month', 'ខែ'], ['Year', 'ឆ្នាំ'],
      ['Monday', 'ថ្ងៃច័ន្ទ'], ['Tuesday', 'ថ្ងៃអង្គារ'], ['Wednesday', 'ថ្ងៃពុធ'], ['Thursday', 'ថ្ងៃព្រហស្បតិ៍'], ['Friday', 'ថ្ងៃសុក្រ'], ['Saturday', 'ថ្ងៃសៅរ៍'], ['Sunday', 'ថ្ងៃអាទិត្យ'],
      ['January', 'ខែមករា', 'ខែ១'], ['February', 'ខែកុម្ភៈ', 'ខែ២'], ['March', 'ខែមីនា', 'ខែ៣'], ['April', 'ខែមេសា', 'ខែ៤'], ['May', 'ខែឧសភា', 'ខែ៥'], ['June', 'ខែមិថុនា', 'ខែ៦'],
      ['July', 'ខែកក្កដា', 'ខែ៧'], ['August', 'ខែសីហា', 'ខែ៨'], ['September', 'ខែកញ្ញា', 'ខែ៩'], ['October', 'ខែតុលា', 'ខែ១០'], ['November', 'ខែវិច្ឆិកា', 'ខែ១១'], ['December', 'ខែធ្នូ', 'ខែ១២'],
      ['Mostly', 'ភាគច្រើន'], ['Will (future)', 'នឹង'], ['Was (past)', 'បាន'], ['Is (continuous)', 'កំពុង'], ['In general', 'ជាទូទៅ'], ['A moment', 'មួយភ្លែត'], ['First', 'ដំបូង'],
      ['Sometimes', 'ពេលខ្លះ'], ['Always', 'តែងតែ'], ['Never', 'មិនដែល'], ['Constantly', 'រហូត'], ['Normally', 'ជាធម្មតា'], ['Once in a while', 'ម្តងម្កាល'], ['Eternally', 'អស់កល្បជានិច្ច'], ['Frequently', 'ញឹកញាប់'],
      ['Morning', 'ព្រឹក'], ['Afternoon', 'រសៀល'], ['Evening', 'ល្ងាច'], ['Night', 'យប់'], ['Breakfast', 'អាហារពេលព្រឹក'], ['Lunch', 'អាហារថ្ងៃត្រង់'], ['Dinner', 'អាហារពេលល្ងាច'],
      ['How many?', 'ប៉ុន្មាន?'], ['What time is it?', 'តើម៉ោងប៉ុន្មាន?'], ['While', 'ខណៈពេលដែល'], ['Duration', 'រយៈពេល']
    ] },
    { id: 'family', level: 1, name: 'Honour titles & family', words: [
      ['Younger brother / sister', 'ប្អូនប្រុស / ប្អូនស្រី', 'younger than you'], ['Older brother / sister', 'បងប្រុស / បងស្រី', 'older than you'],
      ['Younger uncle', 'ពូ', 'much older than you, younger than your parents'], ['Younger aunt', 'មីង', 'much older than you, younger than your parents'],
      ['Older uncle / aunt', 'អ៊ុំប្រុស / អ៊ុំស្រី', 'older than your parents'], ['Grandpa', 'លោកតា'], ['Grandma', 'លោកយាយ'], ['Mother', 'ម្តាយ'], ['Father', 'ឪពុក'],
      ['Siblings', 'បងប្អូន'], ['Child', 'កូន'], ['Friend', 'មិត្តភក្តិ'], ['Husband', 'ប្តី'], ['Wife', 'ប្រពន្ធ'], ['Parents', 'ឪពុកម្តាយ'],
      ['Teacher', 'គ្រូបង្រៀន'], ['Male teacher', 'លោកគ្រូ'], ['Female teacher', 'អ្នកគ្រូ']
    ] },
    { id: 'pronouns', level: 1, name: 'Pronouns', words: [
      ['You', 'អ្នក'], ['Me', 'ខ្ញុំ'], ['It', 'វា'], ['They', 'ពួកគេ'], ['He / she', 'គាត់'], ['She', 'នាង'], ['We', 'ពួកយើង'], ['Everyone', 'ទាំងអស់គ្នា'],
      ['Myself', 'ខ្លួនឯង'], ['Yourself', 'បងឯង'], ['Mine', 'របស់ខ្ញុំ'], ['Yours', 'របស់អ្នក'], ['Theirs', 'របស់គេ'], ['Ours', 'របស់យើង'],
      ['Everyone (in church)', 'បងប្អូនទាំងអស់គ្នា', 'brothers and sisters, all of you']
    ] },
    { id: 'verbs', level: 1, name: 'Important verbs', words: [
      ['Walk around / hang out', 'ដើរលេង'], ['To like', 'ចូលចិត្ត'], ['To love', 'ស្រឡាញ់'], ['To do', 'ធ្វើ'], ['To feel', 'មានអារម្មណ៍'], ['To think', 'គិត'], ['Go', 'ទៅ'], ['Try', 'ព្យាយាម'],
      ['Practice', 'អនុវត្ត'], ['Grow', 'រីកចម្រើន'], ['Learn', 'រៀន'], ['Come', 'មក'], ['Enter', 'ចូល'], ['Leave', 'ចាកចេញ'], ['Have', 'មាន'], ['Bring', 'នាំមក'], ['Can', 'អាច'], ['Put', 'ដាក់'],
      ['Take', 'យក'], ['Clean', 'សម្អាត'], ['Start', 'ចាប់ផ្តើម'], ['Give', 'ផ្តល់ឱ្យ'], ['Want (to do)', 'ចង់'], ['Want (a thing)', 'ចង់បាន'], ['Want (someone to)', 'ចង់ឱ្យ'],
      ['Know (how to)', 'ចេះ'], ['Know (a fact)', 'ដឹង'], ['Know (a person or place)', 'ស្គាល់'], ['Rest', 'សម្រាក'], ['Help', 'ជួយ'], ['Use', 'ប្រើ'], ['Eat', 'ហូប'], ['Sleep', 'គេង'],
      ['Study', 'សិក្សា'], ['To be', 'គឺជា / ជា / គឺ'], ['See', 'ឃើញ'], ['Look', 'មើល'], ['Hear', 'ឮ'], ['Listen', 'ស្តាប់'], ['Laugh', 'សើច'], ['Need', 'ត្រូវការ'], ['Wait', 'រង់ចាំ'], ['Remind', 'រំលឹក'],
      ['Either', 'មួយណាក៏បាន'], ['Work', 'ធ្វើការ'], ['Receive', 'ទទួល'], ['Say', 'និយាយ'], ['Read', 'អាន'], ['Make', 'ធ្វើ'], ['Close / turn off', 'បិទ'], ['Open / turn on', 'បើក'], ['Cry', 'យំ'],
      ['Search', 'ស្វែងរក'], ['Remember', 'ចងចាំ'], ['Have to', 'ត្រូវតែ'], ['Both', 'ទាំងពីរ'], ['Walk', 'ដើរ'], ['Run', 'រត់'], ['Sit', 'អង្គុយ'], ['Stand', 'ឈរ'], ['Jump', 'លោត'], ['Dance', 'រាំ'],
      ['Bite', 'ខាំ'], ['Tell', 'ប្រាប់'], ['Forget', 'ភ្លេច'], ['Explain', 'ពន្យល់'], ['Describe', 'ពិពណ៌នា']
    ] },
    { id: 'connectives', level: 1, name: 'Connective words', words: [
      ['If', 'ប្រសិនបើ / ប្រសិនជា / បើ'], ['So', 'ដូច្នេះ'], ['That / which', 'ដែល'], ['When', 'ពេល'], ['Because', 'ពីព្រោះ / ព្រោះ / ដោយសារ'], ['For', 'សម្រាប់'], ['About', 'អំពី'],
      ['And', 'ហើយនិង / ហើយ / និង'], ['Until', 'រហូតដល់'], ['With', 'ជាមួយ'], ['After', 'បន្ទាប់ពី'], ['Then', 'បន្ទាប់មក'], ['Since', 'ចាប់តាំងពី'], ['Should', 'គួរ'], ['Ever', 'ធ្លាប់'],
      ['In order to', 'ដើម្បី'], ['But', 'ប៉ុន្តែ'], ['Even though', 'ទោះបីជា'], ['Like (similar to)', 'ដូចជា'], ['Maybe', 'ប្រហែល'], ['For example', 'ឧទាហរណ៍'], ['Especially', 'ជាពិសេស'],
      ['Too / also', 'ផងដែរ'], ['Similar', 'ស្រដៀងគ្នា'], ['Different', 'ខុសគ្នា'], ['Same', 'ដូចគ្នា'], ['More (comparative)', 'ជាង'], ['Second', 'ទីពីរ'], ['Finally', 'ទីបំផុត'], ['For (towards)', 'ចំពោះ']
    ] },
    { id: 'questions', level: 1, name: 'Question words', tip: 'A yes/no question: put តើ at the start and អត់ or ទេ at the end. តើបងចូលចិត្តកន្លែងនេះអត់? — Do you like this place?', words: [
      ['Why?', 'ហេតុអ្វី? / ហេតុអ្វីបានជា?'], ['What?', 'អីគេ? / អ្វី?'], ['Where?', 'នៅណា? / កន្លែងណា? / នៅឯណា?'], ['When?', 'ពេលណា?'], ['Who?', 'អ្នកណា? / ណាគេ? / នរណា?'], ['Which?', 'មួយណា?'],
      ['How many?', 'ប៉ុន្មាន?'], ['How? (how do you do that)', 'ដោយរបៀបណា?'], ['How was it?', 'ម៉េចដែរ?'], ['How is it going?', 'ទៅជាយ៉ាងណា?'], ['What? (open question)', 'អ្វីខ្លះ?'],
      ['Can…?', 'អាច…បានអត់ / ទេ?'], ['Can you help me?', 'តើបងអាចជួយខ្ញុំបានអត់?'], ['Do you like this place?', 'តើបងចូលចិត្តកន្លែងនេះអត់?'], ['What time is it?', 'តើម៉ោងប៉ុន្មាន?'],
      ['What year?', 'ឆ្នាំណា?'], ['What month?', 'ខែណា?'], ['What day?', 'ថ្ងៃណា?'], ['How? (which way)', 'របៀបណា?']
    ] },
    { id: 'intro', level: 2, name: 'Self-introduction', words: [
      ['Name', 'ឈ្មោះ'], ['Country', 'ប្រទេស'], ['Age', 'អាយុ'], ['Have', 'មាន'], ['Nationality', 'ជនជាតិ'], ['Hometown', 'ស្រុកកំណើត'], ['Introduce', 'ការណែនាំ'],
      ['Number of people', 'នាក់'], ['Reason', 'ហេតុផល'], ['From', 'មកពី'], ['Siblings', 'បងប្អូន']
    ] },
    { id: 'home', level: 2, name: 'Home nouns', words: [
      ['Bathroom', 'បន្ទប់ទឹក'], ['Stairs', 'ជណ្តើរ'], ['Door', 'ទ្វារ'], ['Table', 'តុ'], ['The roof', 'ដំបូល'], ['Spoon', 'ស្លាបព្រា'], ['Garden', 'សួន'], ['Kitchen', 'ផ្ទះបាយ'], ['Living room', 'បន្ទប់ទទួលភ្ញៀវ'],
      ['Napkin', 'ក្រដាសជូតមាត់'], ['Bedroom', 'បន្ទប់គេង'], ['Chair', 'កៅអី'], ['Shower', 'ងូតទឹក'], ['Toothbrush', 'ច្រាសដុសធ្មេញ'], ['House', 'ផ្ទះ'], ['Couch', 'សាឡុង'], ['Comb', 'ក្រាស់'], ['Fork', 'សម'],
      ['Soap', 'សាប៊ូ'], ['Toilet', 'បង្គន់'], ['Toilet paper', 'ក្រដាសជូតគូទ'], ['Plate', 'ចាន'], ['Mirror', 'កញ្ចក់'], ['Refrigerator', 'ទូរទឹកកក'], ['Bed', 'គ្រែ'], ['Blanket', 'ភួយ'], ['Building', 'អាគារ'],
      ['Cup', 'កែវ'], ['Curtains', 'វាំងនន'], ['Knife', 'កាំបិត'], ['Light', 'អំពូលភ្លើង'], ['Mattress', 'ពូក'], ['Pillow', 'ខ្នើយ'], ['Stove', 'ចង្ក្រាន'], ['Towel', 'កន្សែងពោះគោ'], ['TV', 'ទូរទស្សន៍'],
      ['Pot', 'ឆ្នាំង'], ['Shampoo', 'សាប៊ូកក់សក់'], ['Wall', 'ជញ្ជាំង'], ['Detergent', 'សាប៊ូបោកខោអាវ'], ['Window', 'បង្អួច'], ['Lightbulb', 'អំពូល']
    ] },
    { id: 'homeacts', level: 2, name: 'Home activities', words: [
      ['To cook', 'ធ្វើម្ហូប'], ['To clean', 'សំអាត'], ['Use the bathroom', 'ចូលបន្ទប់ទឹក'], ['Take a shower', 'ងូតទឹក'], ['Wash face', 'លុបមុខ'], ['Comb hair', 'សិតសក់'], ['Wash dishes', 'លាងចាន'],
      ['Wash hands', 'លាងដៃ'], ['Put makeup on', 'ផាត់មុខ'], ['Eat dinner', 'ញ៉ាំបាយ'], ['Watch movies', 'មើលរឿង'], ['Read a book', 'អានសៀវភៅ'], ['Play games', 'លេងហ្គេម'], ['Do the hair', 'ធ្វើសក់'],
      ['Wash hair', 'សំអាតសក់'], ['Have guests', 'មានភ្ញៀវ'], ['Welcome', 'សូមស្វាគមន៍'], ['Get out of bed', 'ក្រោកពីដេក'], ['Sleep', 'ដេក'], ['Hang out', 'អង្គុយលេង'], ['Wash clothes', 'បោកខោអាវ'], ['Hang clothes', 'ហាលខោអាវ']
    ] },
    { id: 'market', level: 2, name: 'Market', words: [
      ['Market', 'ផ្សារ'], ['Buy', 'ទិញ'], ['Sell', 'លក់'], ['Seller', 'អ្នកលក់'], ['Buyer', 'អ្នកទិញ'], ['How much?', 'ថ្លៃប៉ុន្មាន?'], ['Expensive', 'ថ្លៃ'], ['Cheap', 'ថោក'], ['Rip off!', 'ហែក'], ['Discount', 'បញ្ចុះតម្លៃ'],
      ['Salt', 'អំបិល'], ['Sugar', 'ស្ករ'], ['MSG', 'ប៊ីចេង'], ['Oil', 'ប្រេងឆា'], ['Pepper', 'ម្រេច'], ['Fruit', 'ផ្លែឈើ'], ['Mango', 'ស្វាយ'], ['Watermelon', 'ឪឡឹក'], ['Apple', 'ផ្លែប៉ោម'], ['Orange', 'ផ្លែក្រូច'],
      ['Grapes', 'ផ្លែទំពាំងបាយជូរ'], ['Banana', 'ចេក'], ['Coconut', 'ដូង'], ['Papaya', 'ល្ហុង'], ['Pineapple', 'ម្នាស់'], ['Passion fruit', 'ផ្លែជាស់ស៊ិន'], ['Lime', 'ក្រូចឆ្មា'], ['Dragon fruit', 'ផ្លែស្រកានាគ'], ['Jackfruit', 'ផ្លែខ្នុរ'], ['Avocado', 'ផ្លែបឺរ'],
      ['Vegetable', 'បន្លែ'], ['Corn', 'ពោត'], ['Potato', 'ដំឡូងបារាំង'], ['Tomato', 'ប៉េងប៉ោះ'], ['Garlic', 'ខ្ទឹម'], ['Chili pepper', 'ម្ទេសប្លោក'], ['Onion', 'ខ្ទឹមបារាំង'], ['Lettuce', 'សាឡាត់'], ['Ginger', 'ខ្ញី'],
      ['Meat', 'សាច់'], ['Chicken', 'សាច់មាន់'], ['Pork', 'សាច់ជ្រូក'], ['Beef', 'សាច់គោ'], ['Fish', 'ត្រី'], ['Lamb', 'សាច់ចៀម']
    ] },
    { id: 'morning', level: 2, name: 'Morning routine', words: [
      ['Exercise', 'ហាត់ប្រាណ'], ['Spend time with God', 'ចំណាយពេលជាមួយព្រះ'], ['Read the Bible', 'អានគម្ពីរ'], ['Drink water', 'ផឹកទឹក'], ['Go for a walk', 'ចេញដើរលេង'], ['Go for a run', 'ទៅរត់'],
      ['Look at the phone', 'មើលទូរសព្ទ'], ['Plan the day', 'រៀបគម្រោង'], ['Ride a bike', 'ជិះកង់'], ['Write in a journal', 'សរសេរកំណត់ហេតុ'], ['Make your bed', 'រៀបចំគ្រែ']
    ] },
    { id: 'relnouns', level: 2, name: 'Relationships — people', words: [
      ['Girlfriend / boyfriend', 'សង្សារ'], ['Human', 'មនុស្ស'], ['Roommate', 'មិត្តរួមបន្ទប់'], ['Fiancé(e)', 'គូដណ្តឹង']
    ] },
    { id: 'relverbs', level: 2, name: 'Relationships — verbs', words: [
      ['Marry', 'រៀបការ'], ['Become engaged', 'ភ្ជាប់ពាក្យ'], ['Encourage', 'លើកទឹកចិត្ត'], ['Kiss', 'ថើប'], ['Have a crush', 'លួចស្រឡាញ់'], ['To like', 'ចូលចិត្ត'], ['Hug', 'អោប'], ['Break up', 'បែកគ្នា'], ['To love', 'ស្រឡាញ់']
    ] },
    { id: 'physical', level: 2, name: 'Describing looks', words: [
      ['Muscular', 'មានសាច់ដុំ'], ['Handsome', 'សង្ហា'], ['Beautiful', 'ស្អាត'], ['Sexy', 'សិចស៊ី'], ['Tall', 'ខ្ពស់'], ['Blue eyes', 'ភ្នែកខៀវ'], ['Short', 'ទាប'], ['Fat', 'ធាត់'], ['Skinny', 'ស្គម'],
      ['White skin', 'ស្បែកស'], ['Dark skin', 'ស្បែកខ្មៅ'], ['Brown eyes', 'ភ្នែកខ្មៅ'], ['Long hair', 'សក់វែង'], ['Short hair', 'សក់ខ្លី'], ['Bald', 'ក្បាលត្រងោល'], ['Curly hair', 'សក់រួញ'], ['Straight hair', 'សក់ត្រង់'], ['Chubby', 'ធាត់ៗ']
    ] },
    { id: 'character', level: 2, name: 'Describing character', words: [
      ['Kind', 'ចិត្តល្អ'], ['Smart', 'ឆ្លាត'], ['Funny', 'កំប្លែង'], ['Interesting', 'គួរឱ្យចាប់អារម្មណ៍'], ['Gentle', 'សុភាព'], ['Happy', 'សប្បាយ'], ['Rude', 'ឈ្លើយ'], ['Poor', 'ក្រ'], ['Shy', 'អៀន'],
      ['Amazing', 'អស្ចារ្យ'], ['Humble', 'បន្ទាបខ្លួន'], ['Brave', 'ក្លាហាន'], ['Honest / faithful', 'ស្មោះត្រង់'], ['Prideful', 'ក្រអឺតក្រទម'], ['Angry', 'ខឹង'], ['Talented / good at', 'ពូកែ'], ['Calm', 'ស្ងប់ចិត្ត'], ['Wise', 'មានប្រាជ្ញា'],
      ['Selfish', 'អាត្មានិយម'], ['Generous', 'សប្បុរស'], ['Creative', 'ច្នៃប្រឌិត'], ['Lazy', 'ខ្ជិល'], ['Cute', 'គួរឱ្យស្រឡាញ់'], ['Frustrated', 'ម៉ូម៉ៅ'], ['Rich', 'មាន'], ['Lonely', 'ឯកកោ']
    ] },
    { id: 'city', level: 2, name: 'In the city', words: [
      ['Road', 'ផ្លូវ'], ['Moto', 'ម៉ូតូ'], ['Ride', 'ជិះ'], ['Follow the road', 'ទៅតាមផ្លូវ'], ['Go straight', 'ទៅត្រង់'], ['Bike mechanic', 'ជាងកង់'], ['Park', 'សួន'], ['Place', 'ទីកន្លែង'], ['Problem', 'បញ្ហា'], ['Broken', 'ខូច'],
      ['City', 'ទីក្រុង'], ['Bicycle', 'កង់'], ['Bus', 'ឡានក្រុង'], ['Turn left', 'បត់ឆ្វេង'], ['Stop', 'ឈប់'], ['Car mechanic', 'ជាងឡាន'], ['Hospital', 'មន្ទីរពេទ្យ'], ['Fix', 'ជួសជុល'], ['Gas', 'សាំង'], ['Coffee shop', 'ហាងកាហ្វេ'],
      ['Car', 'ឡាន'], ['Drive', 'បើក'], ['Supermarket', 'ផ្សារទំនើប'], ['Turn right', 'បត់ស្តាំ'], ['Moto mechanic', 'ជាងម៉ូតូ'], ['Restaurant', 'ហាងបាយ'], ['Farm', 'ចម្ការ'], ['Gas station', 'កន្លែងចាក់សាំង'], ['Fill it up', 'ចាក់ឱ្យពេញ']
    ] },
    { id: 'ywam', level: 2, name: 'YWAM life', words: [
      ['Staff', 'បុគ្គលិក'], ['Meeting', 'ប្រជុំ'], ['Class', 'ថ្នាក់រៀន'], ['Bible', 'ព្រះគម្ពីរ'], ['Campus', 'ទីស្នាក់ការ'], ['Church planting', 'ដាំដុះក្រុមជំនុំ'], ['Church (the building)', 'ព្រះវិហារ'], ['Church (the people)', 'ក្រុមជំនុំ'],
      ['Community night', 'រាត្រីសហគមន៍'], ['Base', 'មូលដ្ឋាន'], ['Ministry', 'ព័ន្ធកិច្ច'], ['Mercy ministry', 'ព័ន្ធកិច្ចមេត្តាករុណា'], ['School', 'សាលារៀន'], ['Director', 'នាយកសាលា'], ['Department', 'នាយកដ្ឋាន'],
      ['Director team', 'ក្រុមនាយក'], ['Elder team', 'ក្រុមចាស់ទុំ'], ['Leader', 'អ្នកដឹកនាំ'], ['Worship', 'ថ្វាយបង្គំ'], ['Intercession', 'អធិស្ឋានទូលអង្វរ'], ['Work duties', 'ការងារប្រចាំថ្ងៃ'], ['Jesus', 'ព្រះយេស៊ូវ'], ['God', 'ព្រះអង្គ'], ['Holy Spirit', 'ព្រះវិញ្ញាណបរិសុទ្ធ'],
      ['Lead', 'ដឹកនាំ'], ['Discuss', 'ពិភាក្សា'], ['Announcements', 'សេចក្តីប្រកាស'], ['Classroom', 'ថ្នាក់រៀន'], ['Map', 'ផែនទី'], ['Pioneer', 'ការត្រួសត្រាយ'], ['Student', 'សិស្ស'], ['Are you ready?', 'ត្រៀមខ្លួននៅ?'], ['On time', 'ទាន់ពេល'],
      ['Certificate', 'សញ្ញាប័ត្រ'], ['Graduation', 'ទទួលសញ្ញាប័ត្រ'], ['DTS', 'សាលាបណ្តុះបណ្តាលភាពជាសាវ័ក'], ['SBS', 'សាលាសិក្សាព្រះគម្ពីរ'], ['SOMD', 'សាលាបណ្តុះបណ្តាលខ្លួនសម្រាប់ព័ន្ធកិច្ច'], ['Titus', 'សាលាបង្រៀនព្រះគម្ពីរ'],
      ['Small group', 'ក្រុមតូច'], ['One on one', 'មួយទល់មួយ'], ['Morning chores', 'ការងារពេលព្រឹក'], ['Continue on', 'បន្តទៀត'], ['Grow', 'លូតលាស់'], ['Meet', 'ជួប'], ['Snack', 'អាហារសំរន់'], ['Rest', 'សម្រាក'], ['Program', 'កម្មវិធី'],
      ['Join in', 'ចូលរួម'], ['Unity', 'ការរួបរួម'], ['Prayer room', 'បន្ទប់អធិស្ឋាន'], ['Believe', 'ជឿ'], ['Faith', 'សេចក្តីជំនឿ'], ['Society', 'សង្គម'], ['Cafeteria', 'កន្លែងញ៉ាំបាយ'], ['Hut', 'ខ្ទម'], ['Soccer field', 'កន្លែងលេងបាល់'],
      ['Finish', 'ចប់'], ['Stage', 'ឆាក'], ['Media', 'ប្រព័ន្ធផ្សព្វផ្សាយ'], ['New sound', 'សំលេងថ្មី'], ['Party', 'ជប់លៀង'], ['Interrupt', 'រំខាន'], ['Family circle', 'រង្វង់គ្រួសារ'], ['Home circle', 'រង្វង់គ្រួសារ'], ['Office', 'ការិយាល័យ'],
      ['Gateway circle', 'ច្រកចេញចូល'], ['Community life', 'ជីវិតសហគមន៍'], ['Community', 'សហគមន៍'], ['Security', 'សន្តិសុខ'], ['Influence', 'ជះឥទ្ធិពល'], ['Outreach', 'បេសកកម្ម'], ['Missionary', 'បេសកជន'], ['Evangelism', 'ផ្សាយដំណឹងល្អ'],
      ['Bring (people)', 'នាំ'], ['Conference', 'សន្និសីទ'], ['International', 'អន្តរជាតិ'], ['Global', 'សកល'], ['Foreigner', 'ជនបរទេស'], ['Out of something', 'អស់'], ['Out of money', 'អស់លុយហើយ'], ['Finances', 'ថវិកា'], ['Culture', 'វប្បធម៌'],
      ['Fundraising', 'រៃអង្គាសថវិកា'], ['Volunteer', 'អ្នកស្ម័គ្រចិត្ត'], ['Religion', 'សាសនា'], ['Try it out', 'សាកល្បង'], ['Christian', 'គ្រីស្ទាន'], ['Topic', 'ប្រធានបទ'], ['Explain', 'ពន្យល់'], ['Story', 'រឿង'], ['Achieve', 'សម្រេច'],
      ['Process', 'ដំណើរការ'], ['Through', 'តាមរយៈ'], ['Busy', 'រវល់'], ['Problem', 'បញ្ហា'], ['Tired', 'អស់កម្លាំង'], ['Times (how many times)', 'ដង'], ['Really?', 'មែន?'], ['Last night', 'យប់មិញ'], ['This morning', 'ព្រឹកមិញ'],
      ['Enter', 'ចូល'], ['Exit', 'ចេញ'], ['What did you do?', 'ធ្វើអ្វី?']
    ] },
    { id: 'classroom', level: 2, name: 'In the classroom', words: [
      ['Chair', 'កៅអី'], ['Table', 'តុ'], ['Marker', 'ហ្វឺត'], ['Whiteboard', 'ក្តារខៀន'], ['Book', 'សៀវភៅ'], ['Mop (the thing)', 'ប្រដាប់ជូតផ្ទះ'], ['Teacher', 'គ្រូបង្រៀន'], ['Remember?', 'ចាំ?'], ['Forget', 'ភ្លេច'],
      ['Plants', 'រុក្ខជាតិ'], ['Water the plants', 'ស្រោចផ្កា'], ['Point', 'ចង្អុល'], ['Broom', 'អំបោស'], ['Teach', 'បង្រៀន'], ['Make coffee', 'ឆុងកាហ្វេ'], ['Pen', 'ប៊ិច'], ['Pencil', 'ខ្មៅដៃ'], ['Bag', 'កាបូប'], ['Sweep', 'បោស'],
      ['Mop (the action)', 'ជូត'], ['Garbage', 'សំរាម']
    ] },
    { id: 'adjectives', level: 2, name: 'Helpful adjectives', words: [
      ['Big', 'ធំ'], ['Small', 'តូច'], ['Heavy', 'ធ្ងន់'], ['Light', 'ស្រាល'], ['Slippery', 'រអិល'], ['Itchy', 'រមាស់'], ['Scared', 'ខ្លាច'], ['Busy', 'រវល់'], ['Old', 'ចាស់'], ['A little', 'តិច'], ['A lot', 'ច្រើន'],
      ['Soft', 'ទន់'], ['Hard', 'រឹង'], ['Ticklish', 'រសើប'], ['Hot', 'ក្តៅ'], ['Nervous', 'ភ័យ'], ['Excited', 'សប្បាយ'], ['New', 'ថ្មី'], ['Difficult', 'ពិបាក'], ['Easy', 'ស្រួល'], ['Fast', 'លឿន'], ['Slow', 'យឺត'],
      ['Boring', 'ធុញ'], ['Cold', 'ត្រជាក់'], ['Sleepy', 'ងុយដេក'], ['Tired', 'ហត់'], ['Young', 'ក្មេង'], ['Cool', 'ឡូយ'], ['Good', 'ល្អ'], ['Bad', 'អាក្រក់'], ['Positive', 'វិជ្ជមាន'], ['Negative', 'អវិជ្ជមាន'], ['Bored', 'អផ្សុក']
    ] },
    { id: 'restaurant', level: 2, name: 'At a restaurant', words: [
      ['Waiter', 'អ្នករត់តុ'], ['Order', 'កម្មង់'], ['Split the bill', 'បង់លុយផ្សេងគ្នា'], ['Pay', 'បង់លុយ'], ['Sorry', 'សុំទោស'], ['Please', 'សូម'], ['Taxes', 'ពន្ធ'], ['Restaurant', 'ហាងបាយ'], ['Tip', 'ឱ្យលុយក្រៅ'],
      ['Alcohol', 'ស្រា'], ['Wine', 'ស្រាក្រហម'], ['Butter', 'ប៊ឺ'], ['Chef', 'ចុងភៅ'], ['Ingredients', 'គ្រឿង'], ['Money', 'លុយ'], ['Menu', 'បញ្ជីឈ្មោះម្ហូប / ម៉ឺនុយ'], ['Drinks', 'ភេសជ្ជៈ'], ['Hungry', 'ឃ្លាន'], ['Drink', 'ផឹក'],
      ['Bubble tea', 'តែគុជ'], ['Pack the food (to go)', 'រៀបចំម្ហូប'], ['Coffee', 'កាហ្វេ'], ['Special', 'ពិសេស'], ['Cake', 'នំខេក'], ['Bitter', 'ល្វីង'], ['Beer', 'ស្រាបៀរ'], ['Sauce', 'ទឹកជ្រលក់'], ['French fries', 'ដំឡូងបំពង'], ['Water', 'ទឹក'],
      ['Meal', 'អាហារ'], ['Check, please', 'គិតលុយ'], ['Thirsty', 'ស្រេកទឹក'], ['Full', 'ឆ្អែត'], ['Dessert', 'បង្អែម'], ['Flavour', 'រសជាតិ'], ['Spicy', 'ហឹរ'], ['Salty', 'ប្រៃ'], ['Sweet', 'ផ្អែម'], ['Sour', 'ជូរ'],
      ['Bread', 'នំប៉័ង'], ['Grilled meat', 'សាច់អាំង'], ['Ice', 'ទឹកកក'], ['Soup', 'សម្ល']
    ] },
    { id: 'problems', level: 2, name: 'House & moto problems', words: [
      ['Rent', 'ជួល'], ['Problem', 'បញ្ហា'], ['Water leak', 'លេចទឹក'], ['Headlights', 'ភ្លើង'], ['Brakes', 'ហ្វ្រាំង'], ["Doesn't work", 'អត់ដំណើរការ'], ['Landlord', 'ម្ចាស់ផ្ទះ'], ["Won't start (moto)", 'ដេរអត់ឆេះ']
    ] },
    { id: 'hospital', level: 2, name: 'At the hospital', words: [
      ['Pain', 'ឈឺ'], ['Cut', 'កាត់'], ['Headache', 'ឈឺក្បាល'], ['Symptom', 'អាការៈ'], ['Head', 'ក្បាល'], ['Face', 'មុខ'], ['Ears', 'ត្រចៀក'], ['Eyes', 'ភ្នែក'], ['Blood', 'ឈាម'], ['Diabetes', 'ជំងឺទឹកនោមផ្អែម'], ['Health', 'សុខភាព'],
      ['Doctor', 'គ្រូពេទ្យ'], ['Nurse', 'ពេទ្យ'], ['Bone', 'ឆ្អឹង'], ['Body', 'ខ្លួន'], ['Arms', 'ដៃ'], ['Legs', 'ជើង'], ['Emergency', 'បន្ទាន់'], ['Ambulance', 'ឡានសង្គ្រោះបន្ទាន់'], ['Brain', 'ខួរក្បាល'], ['Disease', 'មេរោគ / ជំងឺ'], ['Teeth', 'ធ្មេញ'],
      ['Broken bone', 'បាក់ឆ្អឹង'], ['Fever', 'គ្រុនក្តៅ'], ['Common cold', 'ផ្តាសាយធម្មតា'], ['Throw up', 'ក្អួត'], ['Cancer', 'មហារីក'], ['Allergy', 'ប្រតិកម្ម'], ['Medicine', 'ថ្នាំពេទ្យ'], ['Take medicine', 'លេបថ្នាំ'], ['Bruise', 'ជាំ'], ['Get a vaccine', 'ចាក់វ៉ាក់សាំង'], ['Broken tooth', 'បាក់ធ្មេញ']
    ] },
    { id: 'animals', level: 2, name: 'Animals', words: [
      ['Dog', 'ឆ្កែ'], ['Buffalo', 'ក្របី'], ['Duck', 'ទា'], ['Fish', 'ត្រី'], ['Tiger', 'ខ្លា'], ['Lizard', 'តុកកែ'], ['Snake', 'ពស់'], ['Bug', 'សត្វល្អិត'], ['Frog', 'កង្កែប'], ['Cat', 'ឆ្មា'], ['Bird', 'ចាប'], ['Chicken', 'មាន់'], ['Elephant', 'ដំរី'],
      ['Monkey', 'ស្វា'], ['Alligator', 'ក្រពើ'], ['Bear', 'ខ្លាឃ្មុំ'], ['Butterfly', 'មេអំបៅ'], ['Toad', 'គីង្គក់'], ['Horse', 'សេះ'], ['Cow', 'គោ'], ['Pig', 'ជ្រូក'], ['Lion', 'តោ'], ['Sheep', 'ចៀម'], ['Crocodile', 'ក្រពើ'], ['Mouse / rat', 'កណ្តុរ'], ['Worm', 'ដង្កូវ']
    ] },
    { id: 'landscapes', level: 2, name: 'Landscapes', words: [
      ['Nature', 'ធម្មជាតិ'], ['Ocean', 'សមុទ្រ'], ['Lake', 'បឹង'], ['Plains', 'វាលទំនាប'], ['Rice field', 'វាលស្រែ'], ['Island', 'កោះ'], ['Mountain', 'ភ្នំ'], ['River', 'ទន្លេ'], ['Stream', 'ស្ទឹង'], ['Wet', 'សើម'], ['Land', 'ដី'], ['Waterfall', 'ទឹកធ្លាក់'],
      ['Forest', 'ព្រៃ'], ['Desert', 'ទីរហោស្ថាន'], ['Landscape', 'ទេសភាព'], ['Dry', 'ស្ងួត'], ['Beach', 'ឆ្នេរសមុទ្រ'], ['Shade', 'ម្លប់']
    ] },
    { id: 'body', level: 2, name: 'Bodily functions', words: [
      ['Itchy', 'រមាស់'], ['Sleepy', 'ងុយដេក'], ['Ticklish', 'រសើប'], ['Laughter', 'សើច'], ['Blinking', 'ព្រិចភ្នែក'], ['Pooping', 'បន្ទោបង់'], ['Peeing', 'នោម'], ['Swallow', 'លេប'], ['Fart', 'ផោម'], ['Sweating', 'បែកញើស'], ['Runny nose', 'ហៀរសំបោរ'],
      ['Chewing', 'ទំពា'], ['Biting', 'ខាំ'], ['Cough', 'ក្អក'], ['Sneeze', 'កណ្តាស់'], ['Burp', 'ភើ'], ['Yawn', 'ស្ងាប']
    ] },
    { id: 'shapes', level: 2, name: 'Shapes', words: [
      ['Circle', 'រង្វង់'], ['Square', 'ការ៉េ'], ['Triangle', 'ត្រីកោណ'], ['Octagon', 'អដ្ឋកោណ'], ['Rectangle', 'ចតុកោណកែង'], ['Shape', 'រូបរាង']
    ] },
    { id: 'classifiers', level: 2, name: 'Classifiers', tip: 'The word that follows a number: two people is ពីរនាក់, three bottles is បីដប.', words: [
      ['People', 'នាក់'], ['Eggs / seeds / tablets', 'គ្រាប់'], ['Plates / dishes', 'ចាន'], ['Bottles', 'ដប'], ['Books', 'ក្បាល'], ['Machines', 'គ្រឿង'], ['Monks / gods', 'អង្គ'], ['Images / statues', 'រូប'], ['Barrels', 'ធុង'], ['Boxes', 'ប្រអប់'],
      ['Glasses', 'កែវ'], ['Packets', 'កញ្ចប់'], ['Skewers', 'ចង្កាក់'], ['Bunches / clusters', 'ចង្កោម'], ['Sheaves / bundles', 'បាច់'], ['Lines', 'ជួរ'], ['Groups', 'ក្រុម'], ['Pairs', 'គូ'], ['Scoops', 'វែក'], ['Sets', 'ឈុត'],
      ['Words', 'ម៉ាត់'], ['Bunches of bananas', 'ស្និត'], ['Sheets / leaves (paper)', 'សន្លឹក'], ['Leaves', 'ស្លឹក'], ['Trees / plants', 'ដើម'], ['Cans', 'កំប៉ុង'], ['Dozens', 'ឡូ'], ['Sentences', 'ឃ្លា'], ['Pieces', 'ដុំ']
    ] },
    { id: 'work', level: 3, name: 'Small talk — work', words: [
      ['Work', 'ការងារ'], ['Teacher', 'គ្រូ'], ['Farmer', 'អ្នកស្រែ'], ['Doctor', 'គ្រូពេទ្យ'], ['Construction worker', 'ជាងសំណង់'], ['Mechanic', 'ជាង'], ['Farm', 'ចម្ការ'], ['Cook', 'ធ្វើម្ហូប'], ['Technology', 'បច្ចេកវិទ្យា'],
      ['Missionary', 'បេសកជន'], ['Accountant', 'គណនេយ្យករ'], ['Electrician', 'ជាងអគ្គិសនី'], ['Plumber', 'ជាងទឹក'], ['Engineer', 'វិស្វករ'], ['Architect', 'អ្នកគូសប្លង់'], ['Hospital', 'មន្ទីរពេទ្យ'], ['Work in the field', 'ធ្វើការនៅស្រែ'], ['Art', 'សិល្បៈ'],
      ['Agriculture', 'កសិកម្ម'], ['Education', 'ការអប់រំ'], ['Government', 'រដ្ឋាភិបាល'], ['Healthcare', 'ការថែទាំសុខភាព'], ['Salary', 'ប្រាក់ខែ'], ['Chef', 'ចុងភៅ'], ['School', 'សាលារៀន'], ['Business', 'ជំនួញ'], ['Place of work', 'កន្លែងធ្វើការ']
    ] },
    { id: 'hobbies', level: 3, name: 'Small talk — hobbies', words: [
      ['Sports', 'កីឡា'], ['Basketball', 'បាល់បោះ'], ['Soccer', 'បាល់ទាត់'], ['Volleyball', 'បាល់ទះ'], ['Swimming', 'ហែលទឹក'], ['Exercise', 'ហាត់ប្រាណ'], ['Art', 'សិល្បៈ'], ['Dancing', 'រាំ'], ['Photography', 'ថតរូប'], ['Gardening', 'ដាំដំណាំ'],
      ['Sewing', 'ដេរខោអាវ'], ['Reading', 'អានសៀវភៅ'], ['Watching movies', 'មើលរឿង'], ['Listening to music', 'ស្តាប់ចម្រៀង'], ['Fighting', 'ច្របាច់គ្នា'], ['Riding a bike', 'ជិះកង់'], ['Hiking', 'ឡើងភ្នំ'], ['Camping', 'បោះតង់'], ['Fishing', 'ស្ទូចត្រី'],
      ['Playing games', 'លេងហ្គេម'], ['Playing an instrument', 'លេងភ្លេង'], ['Woodworking', 'ធ្វើឈើ'], ['Language learning', 'រៀនភាសា'], ['Volunteering', 'ការងារស្ម័គ្រចិត្ត']
    ] },
    { id: 'weather', level: 3, name: 'Small talk — weather', words: [
      ['Cold', 'ត្រជាក់'], ['Hot', 'ក្តៅ'], ['Warm', 'ក្តៅអ៊ុនៗ'], ['Wind', 'ខ្យល់'], ['Rain', 'ភ្លៀង'], ['Storm', 'ព្យុះ'], ['Snow', 'ព្រិល'], ['Cloud', 'ពពក'], ['Thunder', 'ផ្គរលាន់'], ['Lightning', 'ផ្លេកបន្ទោរ'], ['Fog', 'ចុះអាប់'], ['Smoke', 'ផ្សែង'],
      ['Humidity', 'ក្តៅសើម'], ['Temperature', 'សីតុណ្ហភាព'], ['Flood', 'ទឹកជំនន់'], ['Rainbow', 'ឥន្ទធនូ'], ['Weather', 'អាកាសធាតុ'], ['Fire', 'ភ្លើង']
    ] },
    { id: 'travel', level: 3, name: 'Small talk — travel', words: [
      ['Travel', 'ធ្វើដំណើរ'], ['Airplane', 'យន្តហោះ'], ['Country', 'ប្រទេស'], ['Tourism', 'ទេសចរណ៍'], ['District', 'ស្រុក'], ['Province', 'ខេត្ត'], ['Continent', 'ទ្វីប'], ['State', 'រដ្ឋ'], ['Train', 'រថភ្លើង']
    ] },
    { id: 'politics', level: 3, name: 'Small talk — politics', words: [
      ['Politics', 'នយោបាយ'], ['News', 'ព័ត៌មាន'], ['Economics', 'សេដ្ឋកិច្ច'], ['Public', 'សាធារណៈ'], ['Private', 'ឯកជន'], ['President', 'ប្រធានាធិបតី'], ['Mayor', 'អភិបាលក្រុង'], ['Corruption', 'អំពើពុករលួយ'], ['System', 'ប្រព័ន្ធ'],
      ['Prime minister', 'នាយករដ្ឋមន្ត្រី'], ['Governor', 'អភិបាល'], ['Government', 'រដ្ឋាភិបាល'], ['Capital city', 'រាជធានី']
    ] },
    { id: 'agriculture', level: 3, name: 'Small talk — agriculture', words: [
      ['Farm', 'ចម្ការ'], ['Farmer', 'អ្នកចម្ការ'], ['Tree', 'ដើមឈើ'], ['Planting a tree', 'ដាំដើមឈើ'], ['Watering', 'ស្រោចទឹក'], ['Fruits', 'ផ្លែឈើ'], ['Plants', 'ដំណាំ'], ['Seeds', 'គ្រាប់'], ['Rice field', 'វាលស្រែ'], ['Raw rice', 'អង្ករ'],
      ['Storing', 'ជង្រុក'], ['Tractor', 'ត្រាក់ទ័រ'], ['Harvest', 'ប្រមូលផល'], ['Roots', 'ឫស'], ['Weeds', 'ស្មៅ'], ['Grass', 'ស្មៅ'], ['Growth', 'ដុះ'], ['Pruning', 'ការកាត់ចេញ']
    ] },
    { id: 'religion', level: 3, name: 'Small talk — religion', words: [
      ['Religion', 'សាសនា'], ['Temple', 'វត្ត'], ['Faith', 'ជំនឿ'], ['Self-reliance', 'ខ្លួនទីពឹងខ្លួន'], ['Buddhism', 'ព្រះពុទ្ធសាសនា'], ['Christianity', 'គ្រិស្តសាសនា'], ['Believe', 'ជឿ'], ['Earning merit', 'ធ្វើបុណ្យ'],
      ['Monks', 'លោកសង្ឃ'], ['Hinduism', 'ព្រហ្មញ្ញសាសនា'], ['Buddha', 'ព្រះពុទ្ធ'], ['Holy book', 'សៀវភៅធម៌']
    ] },
    { id: 'history', level: 3, name: 'Small talk — history', words: [
      ['History', 'ប្រវត្តិសាស្ត្រ'], ['Past', 'អតីតកាល'], ['Khmer Rouge', 'សម័យពលពត'], ['Independence', 'ឯករាជ្យ'], ['Education', 'ការអប់រំ'], ['Swords', 'ដាវ'], ['Tanks', 'រថក្រោះ'], ['Border', 'ព្រំដែន'], ['King', 'ស្តេច'], ['Century', 'សតវត្ស'],
      ['War', 'សង្គ្រាម'], ['Ancestors', 'ដូនតា'], ['Empire', 'អាណាចក្រ'], ['Guns', 'កាំភ្លើង'], ['Refugees', 'ជនភៀសខ្លួន'], ['Flee the country', 'រត់ភៀសខ្លួន'], ['Emperor', 'អធិរាជ'], ['Era', 'សម័យ'], ['Division', 'ការបែងចែក'],
      ['Genealogy', 'ពូជពង្ស'], ['Battle', 'សង្គ្រាម'], ['Bombs', 'គ្រាប់បែក'], ['Refugee camp', 'ជំរំជនភៀសខ្លួន'], ['Fighting', 'វ៉ៃគ្នា']
    ] },
    { id: 'education', level: 3, name: 'Small talk — education', words: [
      ['Education', 'ការអប់រំ'], ['High school', 'វិទ្យាល័យ'], ['University', 'សកលវិទ្យាល័យ'], ['Pre-school', 'សាលាមត្តេយ្យ'], ['Pass the test', 'ប្រឡងជាប់'], ['Points on a test', 'ពិន្ទុ'], ["Master's degree", 'ថ្នាក់អនុបណ្ឌិត'],
      ['Math', 'គណិតវិទ្យា'], ['Science', 'វិទ្យាសាស្ត្រ'], ['Study', 'រៀន'], ['Improve', 'កែលម្អ'], ['Fail the test', 'ប្រឡងធ្លាក់'], ['Graduate', 'ទទួលសញ្ញាប័ត្រ'], ['Doctorate', 'បណ្ឌិត'], ['Subject', 'មុខវិជ្ជា'], ['Principal', 'នាយកសាលា'],
      ['Discipline', 'វិន័យ'], ['Exam / test', 'ប្រឡង'], ['Level', 'កម្រិត'], ["Bachelor's degree", 'បរិញ្ញាបត្រ'], ['Develop', 'អភិវឌ្ឍ']
    ] },
    { id: 'spheres', level: 3, name: 'Seven spheres of society', words: [
      ['Seven spheres of society', 'វិស័យប្រាំពីរនៃសង្គម'], ['Government', 'រដ្ឋាភិបាល'], ['Media', 'ប្រព័ន្ធផ្សព្វផ្សាយ'], ['Family', 'គ្រួសារ'], ['Religion', 'សាសនា'], ['Celebration', 'ធ្វើកម្មវិធី'], ['Economics', 'សេដ្ឋកិច្ច'], ['Education', 'ការអប់រំ'], ['Society', 'សង្គម']
    ] },
    { id: 'deeper', level: 3, name: 'Deeper problems', words: [
      ['Smoking', 'ជក់បារី'], ['Drug addiction', 'ញៀនថ្នាំ'], ['Abuse', 'រំលោភបំពាន'], ['Rape', 'រំលោភ'], ['Not good enough', 'មិនល្អ'], ['Beating', 'វាយ'], ['Yelling', 'ស្រែក'], ['Addiction', 'ញៀន'], ['Partying', 'ជប់លៀង'],
      ['Violence', 'ឈ្លោះគ្នា'], ['Divorce', 'លែងគ្នា'], ['Hurt', 'ឈឺចាប់'], ['Gambling', 'លេងល្បែង'], ['Counselling', 'ការប្រឹក្សាយោបល់'], ['Drunk', 'ស្រវឹង'], ['Porn', 'អាសអាភាស'], ['Hitting', 'វ៉ៃគ្នា'], ['Shooting', 'បាញ់'],
      ['Hurt someone', 'ធ្វើបាបគេ'], ['Suicide', 'សម្លាប់ខ្លួន']
    ] },
    { id: 'christian', level: 3, name: 'Christian words', words: [
      ['Prayer', 'អធិស្ឋាន'], ['Resurrection', 'រស់ឡើងវិញ'], ['Jesus', 'ព្រះយេស៊ូវ'], ['Intercession', 'អធិស្ឋានទូលអង្វរ'], ['Cross', 'ឈើឆ្កាង'], ['God', 'ព្រះអង្គ'], ['Baptism', 'ជ្រមុជទឹក'], ['Die on the cross', 'សុគតលើឈើឆ្កាង'], ['Holy Spirit', 'ព្រះវិញ្ញាណបរិសុទ្ធ'],
      ['God the Father', 'ព្រះវរបិតា'], ['God the Son', 'ព្រះរាជបុត្រា'], ['God the Holy Spirit', 'ព្រះវិញ្ញាណបរិសុទ្ធ'], ['The Trinity', 'ព្រះត្រីឯក'], ['Apostle', 'សាវ័ក'], ['Disciple', 'សិស្ស'], ['Born again', 'កើតជាថ្មី'], ['New life', 'ជីវិតថ្មី'], ['Salvation', 'សេចក្តីសង្គ្រោះ'],
      ['Denomination', 'និកាយ'], ['Sin', 'អំពើបាប'], ['Confess', 'សារភាព'], ['Repent', 'លន់តួ'], ['Anger', 'ខឹង'], ['Mercy', 'មេត្តា'], ['Forgiveness', 'អត់ទោស'], ['Soul', 'ព្រលឹង'], ['Joy', 'អំណរ'], ['Love', 'សេចក្តីស្រឡាញ់'], ['Peace', 'សន្តិភាព'],
      ['Patience', 'អត់ធ្មត់'], ['Kindness', 'ចិត្តល្អ'], ['Goodness', 'ចិត្តល្អ'], ['Heal', 'ព្យាបាល'], ['Will / heart of God', 'ព្រះទ័យព្រះ'], ['Goal', 'គោលដៅ'], ['Evil', 'ចិត្តអាក្រក់'], ['The enemy', 'សត្រូវ'], ['LORD', 'ព្រះអម្ចាស់'], ['Angel', 'ទេវតា'],
      ['Death (of people)', 'សេចក្តីស្លាប់'], ['Death (of a king)', 'ការសុគត'], ['Church', 'ព្រះវិហារ'], ['Heaven', 'ឋានសួគ៌'], ['Hell', 'ឋាននរក'], ['Gospel', 'ដំណឹងល្អ'], ['Evangelism', 'ផ្សាយដំណឹងល្អ'], ['Glory', 'សិរីល្អ'], ['Eternal life', 'ជីវិតអស់កល្ប'],
      ['Grace', 'ព្រះគុណ'], ['Respect', 'គោរព'], ['Focus', 'ផ្តោត'], ['Quality', 'គុណភាព'], ['Perfect', 'ល្អឥតខ្ចោះ'], ['Chapter', 'ជំពូក'], ['New Testament', 'សញ្ញាថ្មី'], ['Old Testament', 'សញ្ញាចាស់'], ['Verse', 'ខ'], ['Second coming', 'យាងមកលើកទី២'],
      ['Gentile', 'សាសន៍ដទៃ'], ['Jew', 'សាសន៍យូដា'], ['Jerusalem', 'ក្រុងយេរូសាឡិម'], ['Israel', 'អ៊ីស្រាអែល'], ['Circumcision', 'ការកាត់ស្បែក'], ['Change', 'ផ្លាស់ប្តូរ'], ['Tradition', 'ប្រពៃណី'], ['Prophet', 'ហោរា'], ['Fasting', 'តម'],
      ['Preach', 'អធិប្បាយ'], ['Worship', 'ថ្វាយបង្គំ'], ['Honour', 'កិត្តិយស'], ['Bible', 'ព្រះគម្ពីរ'], ['The lost', 'អ្នកបាត់បង់'], ['Holy', 'បរិសុទ្ធ'], ['Bless', 'ប្រទានពរ'], ['The best', 'ល្អបំផុត'], ['Congregation', 'ក្រុមជំនុំ'],
      ['Pastor', 'គ្រូគង្វាល'], ['Kneel', 'ក្រាប'], ['Counselling', 'ប្រឹក្សាយោបល់'], ['More / the most', 'ជាង / ជាងគេ'], ['Small group', 'ក្រុមតូច']
    ] }
  ]
};
