import type { StoryCluster, StorySource } from '@/lib/story-types';

const sources = {
  janadesh: (headline: string, url: string): StorySource => ({
    name: 'Janadesh',
    slug: 'janadesh',
    short: 'J',
    organization: 'Janadesh Media Group',
    domain: 'janadesh.example',
    language: 'Hindi',
    headline,
    url,
    publishedAt: '09:18 IST',
    machineTranslated: true,
  }),
  civic: (headline: string, url: string): StorySource => ({
    name: 'The Civic Ledger',
    slug: 'civic-ledger',
    short: 'CL',
    organization: 'Civic Ledger Publishing',
    domain: 'civicledger.example',
    language: 'English',
    headline,
    url,
    publishedAt: '09:31 IST',
  }),
  bharat: (headline: string, url: string): StorySource => ({
    name: 'Bharat Wire',
    slug: 'bharat-wire',
    short: 'BW',
    organization: 'Bharat Wire Cooperative',
    domain: 'bharatwire.example',
    language: 'English',
    headline,
    url,
    publishedAt: '09:05 IST',
  }),
  publicBrief: (headline: string, url: string): StorySource => ({
    name: 'Public Brief',
    slug: 'public-brief',
    short: 'PB',
    organization: 'Public Brief Foundation',
    domain: 'publicbrief.example',
    language: 'English',
    headline,
    url,
    publishedAt: '10:02 IST',
  }),
  delhi: (headline: string, url: string): StorySource => ({
    name: 'Delhi Chronicle',
    slug: 'delhi-chronicle',
    short: 'DC',
    organization: 'Delhi Chronicle Network',
    domain: 'delhichronicle.example',
    language: 'English',
    headline,
    url,
    publishedAt: '08:42 IST',
  }),
  capital: (headline: string, url: string): StorySource => ({
    name: 'Capital Civic',
    slug: 'capital-civic',
    short: 'CC',
    organization: 'Capital Civic Trust',
    domain: 'capitalcivic.example',
    language: 'English',
    headline,
    url,
    publishedAt: '08:51 IST',
  }),
  cityline: (headline: string, url: string): StorySource => ({
    name: 'Cityline Hindi',
    slug: 'cityline-hindi',
    short: 'CH',
    organization: 'Cityline Media',
    domain: 'citylinehindi.example',
    language: 'Hindi',
    headline,
    url,
    publishedAt: '08:46 IST',
    machineTranslated: true,
  }),
  market: (headline: string, url: string): StorySource => ({
    name: 'Market Standard',
    slug: 'market-standard',
    short: 'MS',
    organization: 'Market Standard Ltd',
    domain: 'marketstandard.example',
    language: 'English',
    headline,
    url,
    publishedAt: '07:55 IST',
  }),
  rupee: (headline: string, url: string): StorySource => ({
    name: 'Rupee Desk',
    slug: 'rupee-desk',
    short: 'RD',
    organization: 'Rupee Desk Media',
    domain: 'rupeedesk.example',
    language: 'English',
    headline,
    url,
    publishedAt: '08:11 IST',
  }),
  boundary: (headline: string, url: string): StorySource => ({
    name: 'Boundary India',
    slug: 'boundary-india',
    short: 'BI',
    organization: 'Boundary Sports Media',
    domain: 'boundaryindia.example',
    language: 'English',
    headline,
    url,
    publishedAt: '07:28 IST',
  }),
  sports: (headline: string, url: string): StorySource => ({
    name: 'National Sports Desk',
    slug: 'national-sports-desk',
    short: 'NS',
    organization: 'National Sports Desk Pvt Ltd',
    domain: 'nationalsports.example',
    language: 'English',
    headline,
    url,
    publishedAt: '07:44 IST',
  }),
  byte: (headline: string, url: string): StorySource => ({
    name: 'The Byte Review',
    slug: 'byte-review',
    short: 'BR',
    organization: 'Byte Review Labs',
    domain: 'bytereview.example',
    language: 'English',
    headline,
    url,
    publishedAt: '11:15 IST',
  }),
  signal: (headline: string, url: string): StorySource => ({
    name: 'Signal India',
    slug: 'signal-india',
    short: 'SI',
    organization: 'Signal India Media',
    domain: 'signalindia.example',
    language: 'English',
    headline,
    url,
    publishedAt: '11:26 IST',
  }),
};

export const storyClusters: StoryCluster[] = [
  {
    slug: 'national-clean-mobility-framework',
    category: 'National',
    headline: 'Union cabinet clears framework for cleaner intercity transport',
    headlineHi: 'केंद्रीय मंत्रिमंडल ने स्वच्छ अंतर-शहरी परिवहन ढांचे को मंजूरी दी',
    brief:
      'The Union cabinet approved a demonstration clean-mobility framework for major intercity corridors. The transport ministry says the first phase will focus on charging standards and shared data. Funding allocations and the participating routes have not yet been published. An official note describes the programme as a standards-led pilot, not a nationwide rollout.',
    briefHi:
      'केंद्रीय मंत्रिमंडल ने प्रमुख अंतर-शहरी मार्गों के लिए स्वच्छ परिवहन का प्रदर्शन ढांचा मंजूर किया। परिवहन मंत्रालय के अनुसार पहला चरण चार्जिंग मानकों और साझा डेटा पर केंद्रित होगा। धन आवंटन और शामिल मार्ग अभी प्रकाशित नहीं हुए हैं।',
    status: 'DEVELOPING',
    statusLabel: 'Developing',
    updated: '18 min ago',
    independentSourceCount: 4,
    riskLevel: 'STANDARD',
    reviewState: 'PUBLISHED',
    confirmed: [
      'The cabinet approved the framework and directed the transport ministry to publish implementation guidelines.',
      'The framework includes common charging and mobility-data standards.',
    ],
    confirmedHi: [
      'मंत्रिमंडल ने ढांचे को मंजूरी दी और परिवहन मंत्रालय को कार्यान्वयन दिशानिर्देश प्रकाशित करने को कहा।',
      'ढांचे में साझा चार्जिंग और परिवहन डेटा मानक शामिल हैं।',
    ],
    developing: [
      'The ministry has not named the first corridors or a date for implementation.',
    ],
    developingHi: [
      'मंत्रालय ने पहले मार्गों या कार्यान्वयन की तारीख का नाम नहीं बताया है।',
    ],
    disputed: [],
    disputedHi: [],
    timeline: [
      {
        at: '09:00',
        title: 'Cabinet meeting concludes',
        detail:
          'The official media briefing lists the framework among approved items.',
      },
      {
        at: '09:18',
        title: 'First publisher report',
        detail: 'Janadesh reports that implementation guidelines will follow.',
      },
      {
        at: '10:02',
        title: 'Policy analysis added',
        detail:
          'Public Brief identifies the funding and corridor details still outstanding.',
      },
    ],
    primaryDocument: {
      title: 'Cabinet decisions: clean mobility framework',
      issuer: 'Press Information Bureau — demonstration document',
      url: 'https://example.com/official-mobility-framework',
      publishedAt: '2 September 2026',
    },
    corrections: [
      {
        at: '10:14 IST',
        note: 'Updated to clarify that routes have not yet been announced.',
      },
    ],
    whyShown:
      'This is a nationally significant policy story from four independent publisher organisations and one primary document.',
    sources: [
      sources.janadesh(
        'Cabinet backs national clean transport framework',
        'https://example.com/janadesh-clean-transport',
      ),
      sources.civic(
        'Centre sets common standards for intercity charging',
        'https://example.com/civic-ledger-mobility',
      ),
      sources.bharat(
        'New mobility plan receives cabinet approval',
        'https://example.com/bharat-wire-plan',
      ),
      sources.publicBrief(
        'What the mobility framework does—and leaves open',
        'https://example.com/public-brief-mobility',
      ),
    ],
  },
  {
    slug: 'delhi-air-quality-response',
    category: 'Delhi NCR',
    location: 'Delhi NCR',
    headline:
      'Delhi agencies prepare phased response after air quality worsens',
    headlineHi: 'वायु गुणवत्ता बिगड़ने पर दिल्ली एजेंसियां चरणबद्ध प्रतिक्रिया की तैयारी में',
    brief:
      'Delhi’s pollution control teams have moved additional monitoring units into the city’s east and south. Authorities say no school or construction restrictions are in force. A forecast of deteriorating wind conditions is still being assessed. The city bulletin asks residents to rely on official alerts while the review continues.',
    briefHi:
      'दिल्ली की प्रदूषण नियंत्रण टीमों ने शहर के पूर्व और दक्षिण में अतिरिक्त निगरानी इकाइयां भेजी हैं। अधिकारियों का कहना है कि स्कूल या निर्माण पर कोई पाबंदी लागू नहीं है। हवा की स्थिति बिगड़ने के पूर्वानुमान का आकलन जारी है।',
    status: 'DEVELOPING',
    statusLabel: 'Developing',
    updated: '42 min ago',
    independentSourceCount: 3,
    riskLevel: 'HIGH',
    reviewState: 'EDITOR_REVIEWED',
    confirmed: [
      'Additional mobile monitoring units were deployed on Wednesday morning.',
      'No school or construction restrictions are currently in force.',
    ],
    confirmedHi: [
      'बुधवार सुबह अतिरिक्त मोबाइल निगरानी इकाइयां तैनात की गईं।',
      'अभी स्कूल या निर्माण पर पाबंदी लागू नहीं है।',
    ],
    developing: [
      'Officials are reviewing wind forecasts before deciding whether to escalate the response.',
    ],
    developingHi: [
      'प्रतिक्रिया बढ़ाने से पहले अधिकारी हवा के पूर्वानुमान की समीक्षा कर रहे हैं।',
    ],
    disputed: [],
    disputedHi: [],
    timeline: [
      {
        at: '07:30',
        title: 'Monitoring bulletin published',
        detail:
          'The city bulletin records worsening readings in eastern stations.',
      },
      {
        at: '08:42',
        title: 'Additional units deployed',
        detail: 'Two publisher organisations confirm the deployment.',
      },
    ],
    corrections: [],
    whyShown:
      'You selected Delhi NCR as your local edition. This public-safety story was editor reviewed before publication.',
    sources: [
      sources.delhi(
        'Monitoring stepped up as Delhi air worsens',
        'https://example.com/delhi-air',
      ),
      sources.capital(
        'No curbs yet as agencies review pollution forecast',
        'https://example.com/capital-air',
      ),
      sources.cityline(
        'दिल्ली में वायु निगरानी बढ़ाई गई',
        'https://example.com/cityline-air',
      ),
    ],
  },
  {
    slug: 'upi-small-value-protection',
    category: 'Business',
    headline:
      'Payment networks introduce an extra check for unusual small-value transfers',
    headlineHi: 'असामान्य छोटे भुगतान पर नेटवर्क ने अतिरिक्त जांच शुरू की',
    brief:
      'Two major payment networks have begun testing a risk prompt for unusual repeat transfers under ₹2,000. Banks describe it as a fraud-control pilot, not a new charge or transaction cap. The test currently covers a limited group of users. Participating banks say normal low-value payments should continue without any extra step.',
    briefHi:
      'दो प्रमुख भुगतान नेटवर्क ₹2,000 से कम के असामान्य बार-बार होने वाले लेनदेन पर चेतावनी का परीक्षण कर रहे हैं। बैंकों के अनुसार यह धोखाधड़ी रोकने का पायलट है, कोई नया शुल्क या सीमा नहीं।',
    status: 'VERIFIED',
    statusLabel: 'Confirmed',
    updated: '1 hr ago',
    independentSourceCount: 3,
    riskLevel: 'STANDARD',
    reviewState: 'PUBLISHED',
    confirmed: [
      'The pilot adds a confirmation prompt to a limited set of unusual repeat transfers.',
      'The pilot does not introduce a fee or transaction cap.',
    ],
    confirmedHi: [
      'पायलट कुछ असामान्य बार-बार होने वाले भुगतान में पुष्टि संदेश जोड़ता है।',
      'यह पायलट कोई शुल्क या लेनदेन सीमा नहीं जोड़ता।',
    ],
    developing: [],
    developingHi: [],
    disputed: [],
    disputedHi: [],
    timeline: [
      {
        at: '07:55',
        title: 'Pilot reported',
        detail: 'Market Standard describes the limited bank test.',
      },
      {
        at: '09:12',
        title: 'Network clarification',
        detail: 'A network note says the prompt is not a fee or cap.',
      },
    ],
    corrections: [],
    whyShown:
      'Business is one of your followed topics, and three independent organisations reported the pilot.',
    sources: [
      sources.market(
        'Networks pilot extra fraud check on repeat UPI transfers',
        'https://example.com/market-upi',
      ),
      sources.rupee(
        'Small UPI payments get a new risk prompt in limited test',
        'https://example.com/rupee-upi',
      ),
      sources.janadesh(
        'Banks test warning for unusual payment patterns',
        'https://example.com/janadesh-upi',
      ),
    ],
  },
  {
    slug: 'cricket-series-venue-review',
    category: 'Sports',
    headline: 'Board reviews venue plan for opening match after heavy rain',
    headlineHi: 'भारी बारिश के बाद उद्घाटन मैच के स्थल की समीक्षा',
    brief:
      'Cricket officials are assessing the opening venue after overnight rain affected access roads. One broadcaster reported that the match had already moved, while the board says no change is final. A decision is expected after the afternoon inspection. Both sides agree that ticket holders should wait for an official notice before travelling.',
    briefHi:
      'रात की बारिश से पहुंच मार्ग प्रभावित होने के बाद क्रिकेट अधिकारी उद्घाटन स्थल का आकलन कर रहे हैं। एक प्रसारक ने मैच स्थानांतरित होने की खबर दी, जबकि बोर्ड का कहना है कि कोई फैसला अंतिम नहीं है।',
    status: 'DISPUTED',
    statusLabel: 'Sources differ',
    updated: '2 hrs ago',
    independentSourceCount: 3,
    riskLevel: 'STANDARD',
    reviewState: 'PUBLISHED',
    confirmed: [
      'Officials inspected the ground and surrounding access roads on Wednesday.',
    ],
    confirmedHi: [
      'अधिकारियों ने बुधवार को मैदान और आसपास के पहुंच मार्गों का निरीक्षण किया।',
    ],
    developing: [
      'A final venue decision is expected after the afternoon inspection.',
    ],
    developingHi: ['दोपहर के निरीक्षण के बाद अंतिम स्थल निर्णय की उम्मीद है।'],
    disputed: [
      'Boundary India says the venue has moved; the board, quoted by National Sports Desk, says no decision is final.',
    ],
    disputedHi: [
      'बाउंड्री इंडिया के अनुसार स्थल बदल गया है; नेशनल स्पोर्ट्स डेस्क द्वारा उद्धृत बोर्ड ने कहा कि फैसला अंतिम नहीं है।',
    ],
    timeline: [
      {
        at: '07:28',
        title: 'Venue move reported',
        detail: 'Boundary India cites an unnamed operations source.',
      },
      {
        at: '07:44',
        title: 'Board response',
        detail: 'The board says the inspection is not complete.',
      },
      {
        at: '12:30',
        title: 'Inspection expected',
        detail: 'Officials are due to reassess access and drainage.',
      },
    ],
    corrections: [],
    whyShown:
      'This is a high-interest sports story with a material conflict between sources.',
    sources: [
      sources.boundary(
        'Opening match shifted after rain, sources say',
        'https://example.com/boundary-match',
      ),
      sources.sports(
        'Board denies final decision on rain-hit opener',
        'https://example.com/sports-desk-match',
      ),
      sources.bharat(
        'Venue under review; inspection due this afternoon',
        'https://example.com/bharat-wire-match',
      ),
    ],
  },
  {
    slug: 'open-language-model-india-labs',
    category: 'Technology',
    headline:
      'Research consortium releases open language model for 12 Indian languages',
    headlineHi: 'अनुसंधान समूह ने 12 भारतीय भाषाओं के लिए ओपन मॉडल जारी किया',
    brief:
      'A university-led consortium has released demonstration weights and evaluation notes for a multilingual model covering 12 Indian languages. The release is permitted for research and some commercial uses. Independent performance checks have not yet been published. The consortium also published a model card describing intended uses and known limitations.',
    briefHi:
      'विश्वविद्यालय के नेतृत्व वाले समूह ने 12 भारतीय भाषाओं के मॉडल के प्रदर्शन वेट और मूल्यांकन नोट जारी किए हैं। इसे शोध और कुछ व्यावसायिक उपयोग की अनुमति है। स्वतंत्र प्रदर्शन जांच अभी प्रकाशित नहीं हुई है।',
    status: 'DEVELOPING',
    statusLabel: 'Developing',
    updated: '3 hrs ago',
    independentSourceCount: 3,
    riskLevel: 'STANDARD',
    reviewState: 'PUBLISHED',
    confirmed: [
      'The consortium published model weights, a model card and its evaluation protocol.',
      'The licence permits research and defined commercial uses.',
    ],
    confirmedHi: [
      'समूह ने मॉडल वेट, मॉडल कार्ड और मूल्यांकन प्रक्रिया प्रकाशित की।',
      'लाइसेंस शोध और निर्धारित व्यावसायिक उपयोग की अनुमति देता है।',
    ],
    developing: ['No independent benchmark replication is available yet.'],
    developingHi: ['स्वतंत्र बेंचमार्क पुनरावृत्ति अभी उपलब्ध नहीं है।'],
    disputed: [],
    disputedHi: [],
    timeline: [
      {
        at: '11:00',
        title: 'Model release published',
        detail: 'The consortium posts weights and documentation.',
      },
      {
        at: '11:26',
        title: 'Licence analysis added',
        detail: 'Signal India reviews the permitted uses.',
      },
    ],
    primaryDocument: {
      title: 'Model card and evaluation protocol',
      issuer: 'Indic Systems Research Consortium — demonstration',
      url: 'https://example.com/indic-model-card',
      publishedAt: '2 September 2026',
    },
    corrections: [],
    whyShown:
      'You follow technology and Indian-language computing. The cluster includes the primary model card.',
    sources: [
      sources.byte(
        'Open model targets 12 Indian languages',
        'https://example.com/byte-model',
      ),
      sources.signal(
        'What the new Indic model licence allows',
        'https://example.com/signal-model',
      ),
      sources.janadesh(
        'भारतीय भाषाओं के लिए नया ओपन मॉडल',
        'https://example.com/janadesh-model',
      ),
    ],
  },
  {
    slug: 'gurugram-bus-lanes-pilot',
    category: 'Delhi NCR',
    location: 'Gurugram',
    headline: 'Gurugram starts peak-hour bus-lane pilot on two corridors',
    headlineHi: 'गुरुग्राम ने दो मार्गों पर पीक-आवर बस लेन पायलट शुरू किया',
    brief:
      'Gurugram’s transport agency has begun a four-week bus-lane pilot on two corridors during the morning and evening peak. Private vehicles are not fined during the first awareness week. The agency will publish travel-time data after the pilot. Traffic marshals and temporary signs will guide drivers during the initial period.',
    briefHi:
      'गुरुग्राम परिवहन एजेंसी ने सुबह और शाम के व्यस्त समय में दो मार्गों पर चार सप्ताह का बस लेन पायलट शुरू किया है। जागरूकता सप्ताह में निजी वाहनों पर जुर्माना नहीं लगेगा।',
    status: 'VERIFIED',
    statusLabel: 'Confirmed',
    updated: '4 hrs ago',
    independentSourceCount: 2,
    riskLevel: 'STANDARD',
    reviewState: 'PUBLISHED',
    confirmed: [
      'The four-week pilot operates on two corridors during morning and evening peaks.',
      'The first week is for awareness and carries no private-vehicle fine.',
    ],
    confirmedHi: [
      'चार सप्ताह का पायलट सुबह और शाम के व्यस्त समय में दो मार्गों पर चलेगा।',
      'पहला सप्ताह जागरूकता के लिए है और निजी वाहनों पर जुर्माना नहीं होगा।',
    ],
    developing: ['Travel-time results will be published after the pilot.'],
    developingHi: ['यात्रा समय के परिणाम पायलट के बाद प्रकाशित होंगे।'],
    disputed: [],
    disputedHi: [],
    timeline: [
      {
        at: '06:30',
        title: 'Pilot begins',
        detail: 'Marshals and signs are placed on both corridors.',
      },
      {
        at: '09:45',
        title: 'First peak period ends',
        detail: 'The agency reports an awareness-only first week.',
      },
    ],
    primaryDocument: {
      title: 'Bus-lane pilot traffic notice',
      issuer: 'Gurugram Mobility Agency — demonstration',
      url: 'https://example.com/gurugram-bus-notice',
      publishedAt: '2 September 2026',
    },
    corrections: [],
    whyShown: 'This story is within your selected Delhi NCR local edition.',
    sources: [
      sources.capital(
        'Gurugram opens two peak-hour bus lanes',
        'https://example.com/capital-bus-lane',
      ),
      sources.delhi(
        'No fines in first week of bus-lane pilot',
        'https://example.com/delhi-bus-lane',
      ),
    ],
  },
  {
    slug: 'solar-manufacturing-credit',
    category: 'Business',
    headline:
      'Manufacturers seek clarification on proposed solar supply credit',
    headlineHi: 'सौर आपूर्ति क्रेडिट पर निर्माताओं ने स्पष्टीकरण मांगा',
    brief:
      'Industry groups have asked the renewable-energy ministry to clarify eligibility for a proposed domestic supply credit. Reports disagree on whether older factories will qualify. The ministry says draft rules remain open for consultation and no final eligibility decision has been issued.',
    briefHi:
      'उद्योग समूहों ने प्रस्तावित घरेलू आपूर्ति क्रेडिट की पात्रता स्पष्ट करने को कहा है। पुरानी फैक्ट्रियों की पात्रता पर रिपोर्ट अलग हैं। मंत्रालय का कहना है कि मसौदा नियम परामर्श के लिए खुले हैं।',
    status: 'DISPUTED',
    statusLabel: 'Sources differ',
    updated: '5 hrs ago',
    independentSourceCount: 3,
    riskLevel: 'STANDARD',
    reviewState: 'PUBLISHED',
    confirmed: [
      'Draft rules are open for consultation.',
      'Industry groups submitted eligibility questions to the ministry.',
    ],
    confirmedHi: [
      'मसौदा नियम परामर्श के लिए खुले हैं।',
      'उद्योग समूहों ने मंत्रालय को पात्रता संबंधी प्रश्न भेजे हैं।',
    ],
    developing: ['Final eligibility rules have not been issued.'],
    developingHi: ['अंतिम पात्रता नियम जारी नहीं हुए हैं।'],
    disputed: [
      'Two reports reach different conclusions about whether older factories qualify under the draft.',
    ],
    disputedHi: [
      'दो रिपोर्ट मसौदे के तहत पुरानी फैक्ट्रियों की पात्रता पर अलग निष्कर्ष देती हैं।',
    ],
    timeline: [
      {
        at: '08:00',
        title: 'Consultation submission filed',
        detail: 'An industry association publishes its response.',
      },
      {
        at: '09:30',
        title: 'Ministry clarification',
        detail: 'A spokesperson says eligibility is not final.',
      },
    ],
    corrections: [],
    whyShown:
      'This material business-policy story has independent reporting and a documented source conflict.',
    sources: [
      sources.market(
        'Older solar units may miss supply credit',
        'https://example.com/market-solar',
      ),
      sources.rupee(
        'Draft credit appears to include upgraded factories',
        'https://example.com/rupee-solar',
      ),
      sources.bharat(
        'Solar credit rules remain open, ministry says',
        'https://example.com/bharat-solar',
      ),
    ],
  },
];

export const sourceProfiles = [
  {
    slug: 'janadesh',
    name: 'Janadesh',
    organization: 'Janadesh Media Group',
    description:
      'A fictional Hindi-language national publisher used only for Nuzenio demonstration data.',
    languages: ['Hindi'],
    domains: ['janadesh.example', 'janadeshbusiness.example'],
    ownership: 'Janadesh Media Group',
    rights: 'Headline, excerpt and canonical-link demo permission',
    feedHealth: 'Healthy',
    correctionPolicy: 'Published corrections are carried on article pages.',
  },
  {
    slug: 'civic-ledger',
    name: 'The Civic Ledger',
    organization: 'Civic Ledger Publishing',
    description:
      'A fictional public-policy publication used only for Nuzenio demonstration data.',
    languages: ['English'],
    domains: ['civicledger.example'],
    ownership: 'Civic Ledger Publishing',
    rights: 'Licensed RSS excerpt demo policy',
    feedHealth: 'Healthy',
    correctionPolicy: 'Corrections are date-stamped and appended.',
  },
  {
    slug: 'bharat-wire',
    name: 'Bharat Wire',
    organization: 'Bharat Wire Cooperative',
    description:
      'A fictional national news cooperative used only for Nuzenio demonstration data.',
    languages: ['English', 'Hindi'],
    domains: ['bharatwire.example'],
    ownership: 'Bharat Wire Cooperative',
    rights: 'Licensed API excerpt demo policy',
    feedHealth: 'Delayed',
    correctionPolicy:
      'Advisories and corrections replace earlier wire versions.',
  },
  {
    slug: 'delhi-chronicle',
    name: 'Delhi Chronicle',
    organization: 'Delhi Chronicle Network',
    description:
      'A fictional Delhi NCR local publisher used only for Nuzenio demonstration data.',
    languages: ['English'],
    domains: ['delhichronicle.example', 'southdelhi.example'],
    ownership: 'Delhi Chronicle Network',
    rights: 'Headline and summary-link demo permission',
    feedHealth: 'Healthy',
    correctionPolicy: 'Updates are timestamped on each report.',
  },
];

export function getStory(slug: string) {
  return storyClusters.find((story) => story.slug === slug);
}
export function getSource(slug: string) {
  return (
    sourceProfiles.find((source) => source.slug === slug) ??
    (() => {
      const articleSource = storyClusters
        .flatMap((story) => story.sources)
        .find((source) => source.slug === slug);
      return articleSource
        ? {
            slug: articleSource.slug,
            name: articleSource.name,
            organization: articleSource.organization,
            description:
              'A fictional publisher profile used only for Nuzenio demonstration data.',
            languages: [articleSource.language],
            domains: [articleSource.domain],
            ownership: articleSource.organization,
            rights: 'Demo feed policy',
            feedHealth: 'Healthy',
            correctionPolicy: 'Updates are timestamped.',
          }
        : undefined;
    })()
  );
}
