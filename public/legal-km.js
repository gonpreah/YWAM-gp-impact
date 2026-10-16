/* Khmer for the legal documents' own text (portal.html, lk_): English → Khmer,
   word for word against the English in netlify/functions/legal-docs-default.js.
   When the portal is in Khmer, the signing page and the admin's preview show
   these in place of the English; anything not here stays English. The record
   of what was signed (and its PDF) keeps the English text, as before.

   So far: the Volunteer Staff Contract. Translated by Claude at Uriah's request,
   Oct 2026 — NOT yet reviewed by a Khmer speaker: a legal text, so have it
   checked. Change a line here, never the key (the key is the English). */
var LEGAL_KM = {
  "Volunteer Staff Contract": "កិច្ចសន្យាបុគ្គលិកស្ម័គ្រចិត្ត",
  "Rules of Contract": "វិធាននៃកិច្ចសន្យា",
  "Staff (A) agrees to work with University of the Nations, Cambodia as a non-salaried volunteer staff member.": "បុគ្គលិក (ក) យល់ព្រមធ្វើការជាមួយសាកលវិទ្យាល័យនៃប្រជាជាតិ កម្ពុជា ជាបុគ្គលិកស្ម័គ្រចិត្តដែលមិនទទួលប្រាក់ខែ។",
  "Staff (A) is required to be honest and open with all aspects of his/her work duties.": "បុគ្គលិក (ក) ត្រូវតែស្មោះត្រង់ និងបើកចំហ ក្នុងគ្រប់ផ្នែកនៃភារកិច្ចការងាររបស់ខ្លួន។",
  "Staff (A) must work within the leadership structure of this organization. Staff (A) must be accountable to his/her leader and follow the decisions that his/her leaders make.": "បុគ្គលិក (ក) ត្រូវធ្វើការក្នុងរចនាសម្ព័ន្ធដឹកនាំរបស់អង្គការនេះ។ បុគ្គលិក (ក) ត្រូវទទួលខុសត្រូវចំពោះអ្នកដឹកនាំរបស់ខ្លួន ហើយធ្វើតាមការសម្រេចចិត្តរបស់អ្នកដឹកនាំ។",
  "Staff (A) is expected to attend all regular staff meetings. If Staff (A) is unable to attend, he/she must inform a leader beforehand.": "បុគ្គលិក (ក) ត្រូវចូលរួមកិច្ចប្រជុំបុគ្គលិកប្រចាំទាំងអស់។ ប្រសិនបើបុគ្គលិក (ក) មិនអាចចូលរួមបាន ត្រូវជូនដំណឹងដល់អ្នកដឹកនាំជាមុន។",
  "Staff (A) is expected to pay a monthly office fee according to his nationality and marital status.": "បុគ្គលិក (ក) ត្រូវបង់ថ្លៃការិយាល័យប្រចាំខែ តាមសញ្ជាតិ និងស្ថានភាពអាពាហ៍ពិពាហ៍របស់ខ្លួន។",
  "Staff (A) will receive a break for all major public holidays in Cambodia, as determined by the University of the Nations, Cambodia.": "បុគ្គលិក (ក) នឹងទទួលបានការឈប់សម្រាកក្នុងថ្ងៃបុណ្យសាធារណៈធំៗទាំងអស់នៅកម្ពុជា ដូចដែលបានកំណត់ដោយសាកលវិទ្យាល័យនៃប្រជាជាតិ កម្ពុជា។",
  "Staff (A) is expected to take a vacation every 3-4 months for up to 2 weeks and a furlough of longer-term rest and renewal every 1-2 years. This furlough should be 6 weeks or more outside Cambodia. This is a time to reconnect with friends, family, and supporters. (These furloughs need to be planned in advance and approved by the local UofN leadership).": "បុគ្គលិក (ក) ត្រូវឈប់សម្រាករៀងរាល់ ៣-៤ ខែម្តង រហូតដល់ ២ សប្តាហ៍ និងឈប់សម្រាករយៈពេលវែង ដើម្បីសម្រាក និងស្តារកម្លាំងឡើងវិញ រៀងរាល់ ១-២ ឆ្នាំម្តង។ ការឈប់សម្រាករយៈពេលវែងនេះ គួរមានរយៈពេល ៦ សប្តាហ៍ ឬច្រើនជាងនេះ នៅក្រៅប្រទេសកម្ពុជា។ នេះជាពេលវេលាដើម្បីជួបជុំឡើងវិញជាមួយមិត្តភក្តិ ក្រុមគ្រួសារ និងអ្នកគាំទ្រ។ (ការឈប់សម្រាកទាំងនេះ ត្រូវរៀបចំផែនការជាមុន និងទទួលបានការអនុម័តពីថ្នាក់ដឹកនាំ UofN ក្នុងតំបន់)។",
  "Staff (A) is expected to have health insurance with coverage for medical evacuations.": "បុគ្គលិក (ក) ត្រូវមានធានារ៉ាប់រងសុខភាព ដែលគ្របដណ្តប់ការដឹកជញ្ជូនសង្គ្រោះបន្ទាន់ផ្នែកវេជ្ជសាស្ត្រ។",
  "Staff (A) is expected to learn the Khmer language and culture while working in Cambodia.": "បុគ្គលិក (ក) ត្រូវរៀនភាសា និងវប្បធម៌ខ្មែរ ក្នុងពេលធ្វើការនៅកម្ពុជា។",
  "Staff (A) is expected to be respectful of Cambodian culture at all times.": "បុគ្គលិក (ក) ត្រូវគោរពវប្បធម៌កម្ពុជាគ្រប់ពេលវេលា។",
  "Staff (A) is expected to follow the security, child protection, and other policies that are described in the University of the Nations, Cambodia staff manual.": "បុគ្គលិក (ក) ត្រូវអនុវត្តតាមគោលការណ៍សន្តិសុខ ការការពារកុមារ និងគោលការណ៍ផ្សេងៗទៀត ដែលមានចែងក្នុងសៀវភៅណែនាំបុគ្គលិករបស់សាកលវិទ្យាល័យនៃប្រជាជាតិ កម្ពុជា។",
  "Conditions of Contract": "លក្ខខណ្ឌនៃកិច្ចសន្យា",
  "If Staff (A) or University of the Nations, Cambodia decides to terminate this contract, they must submit a written letter at least 6 months before the intended termination date. In this letter, the reason for termination must be explained explicitly.": "ប្រសិនបើបុគ្គលិក (ក) ឬសាកលវិទ្យាល័យនៃប្រជាជាតិ កម្ពុជា សម្រេចចិត្តបញ្ចប់កិច្ចសន្យានេះ ត្រូវដាក់លិខិតជាលាយលក្ខណ៍អក្សរ យ៉ាងហោចណាស់ ៦ ខែ មុនកាលបរិច្ឆេទបញ្ចប់ដែលបានគ្រោងទុក។ នៅក្នុងលិខិតនេះ ត្រូវពន្យល់ពីមូលហេតុនៃការបញ្ចប់ឱ្យបានច្បាស់លាស់។",
  "All staff must complete an initial evaluation with members of leadership after serving their first 3 months with YWAM Siem Reap to confirm this location is where they will remain serving.": "បុគ្គលិកទាំងអស់ត្រូវធ្វើការវាយតម្លៃដំបូងជាមួយសមាជិកថ្នាក់ដឹកនាំ បន្ទាប់ពីបម្រើការបាន ៣ ខែដំបូងជាមួយ YWAM សៀមរាប ដើម្បីបញ្ជាក់ថាទីតាំងនេះជាកន្លែងដែលពួកគេនឹងបន្តបម្រើ។",
  "If Staff (A) is found to have committed serious acts of misconduct (violent behavior, stealing, major moral failing, etc), University of the Nations, Cambodia has the right to terminate this contract immediately.": "ប្រសិនបើរកឃើញថាបុគ្គលិក (ក) បានប្រព្រឹត្តអំពើខុសឆ្គងធ្ងន់ធ្ងរ (អំពើហិង្សា ការលួច ការធ្លាក់ខ្លួនខាងសីលធម៌ធ្ងន់ធ្ងរ ។ល។) សាកលវិទ្យាល័យនៃប្រជាជាតិ កម្ពុជា មានសិទ្ធិបញ្ចប់កិច្ចសន្យានេះភ្លាមៗ។",
  "Personal Unto-Statement / Commitment": "សេចក្តីថ្លែងការណ៍ផ្ទាល់ខ្លួន / ការប្តេជ្ញាចិត្ត",
  "During my time in Siem Reap, I commit to focusing on the following areas to better develop myself and the ministries I am a part of:": "ក្នុងអំឡុងពេលនៅសៀមរាប ខ្ញុំប្តេជ្ញាផ្តោតលើផ្នែកខាងក្រោម ដើម្បីអភិវឌ្ឍខ្លួនខ្ញុំ និងការបម្រើដែលខ្ញុំចូលរួម ឱ្យកាន់តែប្រសើរឡើង៖",
  "Area 1": "ផ្នែកទី ១",
  "Area 2": "ផ្នែកទី ២",
  "Area 3": "ផ្នែកទី ៣",
  "I will focus on these areas because in the future…": "ខ្ញុំនឹងផ្តោតលើផ្នែកទាំងនេះ ព្រោះនៅថ្ងៃអនាគត…",
  "Agreement with this Contract and our Organizational Values": "ការយល់ព្រមលើកិច្ចសន្យានេះ និងគុណតម្លៃរបស់អង្គការយើង",
  "I, {name}, have read through this contract and agree to adhere to the rules and conditions of this contract. I have also read through the values of this organization and agree to operate within those principles.": "ខ្ញុំ {name} បានអានកិច្ចសន្យានេះ ហើយយល់ព្រមគោរពតាមវិធាន និងលក្ខខណ្ឌនៃកិច្ចសន្យានេះ។ ខ្ញុំក៏បានអានគុណតម្លៃរបស់អង្គការនេះ ហើយយល់ព្រមធ្វើការស្របតាមគោលការណ៍ទាំងនោះ។",
  "Youth with a Mission, Siem Reap · Traing Village, Slar Kram Commune, Siem Reap City, Krong Siem Reap, Kingdom of Cambodia": "យុវជនដែលមានបេសកកម្ម សៀមរាប (YWAM Siem Reap) · ភូមិត្រាំង សង្កាត់ស្លក្រាម ក្រុងសៀមរាប ខេត្តសៀមរាប ព្រះរាជាណាចក្រកម្ពុជា"
};
