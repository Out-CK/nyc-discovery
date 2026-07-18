/**
 * NYC Discovery — Seed Script
 * Generates 300 canonical NYC entities with realistic metadata,
 * media, reviews, occurrences, and 100 feed-ready posts.
 *
 * Run: npx ts-node --esm scripts/seed.ts
 * Or:  npx tsx scripts/seed.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, n)
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10
}

function future(daysMin: number, daysMax: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + rand(daysMin, daysMax))
  d.setHours(rand(18, 22), pick([0, 30]), 0, 0)
  return d
}

function futurePlus(start: Date, hours: number): Date {
  return new Date(start.getTime() + hours * 3600000)
}

function computeCompleteness(e: {
  address: string | null
  neighborhood: string | null
  website: string | null
  phone: string | null
  business_hours: string | null
  media_count: number
  has_description: boolean
}): number {
  let score = 0
  if (e.address) score += 0.2
  if (e.neighborhood) score += 0.15
  if (e.website) score += 0.15
  if (e.phone) score += 0.1
  if (e.business_hours) score += 0.1
  if (e.media_count > 0) score += 0.15
  if (e.has_description) score += 0.15
  return Math.min(score, 1.0)
}

// ─── Reference Data ───────────────────────────────────────────────────────────

const NYC_NEIGHBORHOODS = [
  'Lower East Side', 'East Village', 'West Village', 'SoHo', 'Tribeca',
  'Williamsburg', 'Bushwick', 'Park Slope', 'Crown Heights', 'DUMBO',
  'Astoria', 'Long Island City', 'Harlem', 'Upper West Side', 'Upper East Side',
  'Chelsea', "Hell's Kitchen", 'Midtown', 'Greenpoint', 'Bed-Stuy',
  'Prospect Heights', 'Carroll Gardens', 'Cobble Hill', 'Fort Greene', 'Ridgewood',
  'Flushing', 'Jackson Heights', 'Sunset Park', 'Bay Ridge', 'Flatbush',
]

const BOROUGH_MAP: Record<string, string> = {
  'Lower East Side': 'Manhattan', 'East Village': 'Manhattan', 'West Village': 'Manhattan',
  'SoHo': 'Manhattan', 'Tribeca': 'Manhattan', "Hell's Kitchen": 'Manhattan',
  'Chelsea': 'Manhattan', 'Midtown': 'Manhattan', 'Harlem': 'Manhattan',
  'Upper West Side': 'Manhattan', 'Upper East Side': 'Manhattan',
  'Williamsburg': 'Brooklyn', 'Bushwick': 'Brooklyn', 'Park Slope': 'Brooklyn',
  'Crown Heights': 'Brooklyn', 'DUMBO': 'Brooklyn', 'Greenpoint': 'Brooklyn',
  'Bed-Stuy': 'Brooklyn', 'Prospect Heights': 'Brooklyn', 'Carroll Gardens': 'Brooklyn',
  'Cobble Hill': 'Brooklyn', 'Fort Greene': 'Brooklyn', 'Sunset Park': 'Brooklyn',
  'Bay Ridge': 'Brooklyn', 'Flatbush': 'Brooklyn',
  'Astoria': 'Queens', 'Long Island City': 'Queens', 'Jackson Heights': 'Queens',
  'Flushing': 'Queens', 'Ridgewood': 'Queens',
}

const HOURS_TEMPLATES = [
  { Monday: '11am–10pm', Tuesday: '11am–10pm', Wednesday: '11am–10pm', Thursday: '11am–11pm', Friday: '11am–12am', Saturday: '10am–12am', Sunday: '10am–10pm' },
  { Monday: 'Closed', Tuesday: '5pm–11pm', Wednesday: '5pm–11pm', Thursday: '5pm–11pm', Friday: '5pm–1am', Saturday: '12pm–1am', Sunday: '12pm–10pm' },
  { Monday: '9am–6pm', Tuesday: '9am–6pm', Wednesday: '9am–8pm', Thursday: '9am–8pm', Friday: '9am–6pm', Saturday: '10am–5pm', Sunday: 'Closed' },
  { Monday: '6am–9pm', Tuesday: '6am–9pm', Wednesday: '6am–9pm', Thursday: '6am–9pm', Friday: '6am–8pm', Saturday: '7am–7pm', Sunday: '7am–5pm' },
]

// ─── Restaurant Data ──────────────────────────────────────────────────────────

const RESTAURANT_DATA = [
  { name: 'Russ & Daughters Cafe', desc: 'Iconic Lower East Side appetizing shop serving smoked fish, bagels, and Jewish-American classics since 1914.', nb: 'Lower East Side', addr: '127 Orchard St, New York, NY 10002', website: 'https://www.russanddaughterscafe.com', phone: '(212) 475-4881', ig: 'russanddaughterscafe', tags: ['bagels', 'smoked fish', 'brunch', 'classic NYC', 'Jewish deli', 'brunch spot'], price: 3, rating: 4.6, reviews: 1200, source: 'https://www.yelp.com/biz/russ-daughters-cafe-new-york' },
  { name: 'Lucali', desc: 'Legendary Brooklyn pizza joint known for thin-crust pies and homemade calzones. Cash only, BYOB.', nb: 'Carroll Gardens', addr: '575 Henry St, Brooklyn, NY 11231', website: 'https://www.lucali.com', phone: '(718) 858-4086', ig: 'lucalipizza', tags: ['pizza', 'BYOB', 'date night', 'Brooklyn', 'cash only', 'thin crust'], price: 2, rating: 4.8, reviews: 3400, source: 'https://www.yelp.com/biz/lucali-brooklyn' },
  { name: 'Xi\'an Famous Foods', desc: 'Bold hand-ripped noodles and lamb burgers from Shaanxi province, with outposts across the city.', nb: 'Midtown', addr: '81 St Marks Pl, New York, NY 10003', website: 'https://xianfoods.com', phone: '(212) 786-2068', ig: 'xianfamousfoods', tags: ['Chinese', 'noodles', 'spicy', 'lamb', 'quick lunch', 'East Village'], price: 1, rating: 4.4, reviews: 2100, source: 'https://xianfoods.com' },
  { name: 'Cosme', desc: 'Chef Enrique Olvera\'s upscale Mexican restaurant offering refined dishes rooted in Mexican tradition.', nb: 'Flatiron', addr: '35 E 21st St, New York, NY 10010', website: 'https://cosmenyc.com', phone: '(212) 913-9659', ig: 'cosmenyc', tags: ['Mexican', 'fine dining', 'upscale', 'tasting menu', 'cocktails', 'date night'], price: 4, rating: 4.5, reviews: 890, source: 'https://cosmenyc.com' },
  { name: 'Roberta\'s', desc: 'The Brooklyn pizza institution that launched a thousand rooftop gardens. Wood-fired pies, natural wine, and a legendary backyard.', nb: 'Bushwick', addr: '261 Moore St, Brooklyn, NY 11206', website: 'https://www.robertaspizza.com', phone: '(718) 417-1118', ig: 'robertaspizza', tags: ['pizza', 'wood-fired', 'Brooklyn', 'natural wine', 'cool vibe', 'outdoor seating'], price: 2, rating: 4.4, reviews: 5600, source: 'https://www.robertaspizza.com' },
  { name: 'Superiority Burger', desc: 'Tiny East Village spot serving creative vegetarian burgers and sides that non-vegetarians crave.', nb: 'East Village', addr: '119 Avenue A, New York, NY 10009', website: 'https://www.superiorityburger.com', phone: '(212) 256-1192', ig: 'superiorityburger', tags: ['vegetarian', 'burger', 'East Village', 'creative', 'casual', 'cult favorite'], price: 1, rating: 4.5, reviews: 1800, source: 'https://www.superiorityburger.com' },
  { name: 'Don Angie', desc: 'Modern Italian-American in the West Village with creative pasta and Sunday sauce — one of NYC\'s best reservations.', nb: 'West Village', addr: '103 Greenwich Ave, New York, NY 10014', website: 'https://www.donangie.com', phone: '(212) 889-8884', ig: 'donangie', tags: ['Italian', 'pasta', 'West Village', 'date night', 'upscale casual', 'brunch'], price: 3, rating: 4.7, reviews: 720, source: 'https://www.donangie.com' },
  { name: 'Ugly Baby', desc: 'Fiery, uncompromising Thai cooking from Chef Sirichai Sreparplarn. No menu adaptations — just exceptional food.', nb: 'Carroll Gardens', addr: '407 Smith St, Brooklyn, NY 11231', website: 'https://uglybabyny.com', phone: '(929) 269-0471', ig: 'uglybabyny', tags: ['Thai', 'spicy', 'Brooklyn', 'authentic', 'BYOB', 'dinner'], price: 2, rating: 4.6, reviews: 940, source: 'https://uglybabyny.com' },
  { name: 'The Commodore', desc: 'Williamsburg dive bar beloved for its fried chicken, frozen margaritas, and no-frills good times.', nb: 'Williamsburg', addr: '366 Metropolitan Ave, Brooklyn, NY 11211', website: 'https://thecommodorebar.com', phone: '(718) 218-7632', ig: 'thecommodorebar', tags: ['bar', 'fried chicken', 'casual', 'Williamsburg', 'late night', 'cocktails'], price: 1, rating: 4.3, reviews: 2200, source: 'https://thecommodorebar.com' },
  { name: 'Olmsted', desc: 'Park Slope gem with a backyard garden, inventive New American cuisine, and one of the best tasting menus in Brooklyn.', nb: 'Prospect Heights', addr: '659 Vanderbilt Ave, Brooklyn, NY 11238', website: 'https://olmstednyc.com', phone: '(718) 552-2610', ig: 'olmstednyc', tags: ['New American', 'garden', 'tasting menu', 'Brooklyn', 'romantic', 'seasonal'], price: 4, rating: 4.6, reviews: 680, source: 'https://olmstednyc.com' },
  { name: 'Paulie Gee\'s', desc: 'Artisan Neapolitan pizza in a cozy Greenpoint space — rotating specials, great vibe, wood-burning oven.', nb: 'Greenpoint', addr: '60 Greenpoint Ave, Brooklyn, NY 11222', website: 'https://pauliegee.com', phone: '(347) 987-3747', ig: 'pauliegees', tags: ['pizza', 'Neapolitan', 'Brooklyn', 'artisan', 'wood oven', 'casual'], price: 2, rating: 4.7, reviews: 1400, source: 'https://pauliegee.com' },
  { name: 'The NoMad Bar', desc: 'Lavish cocktail bar inside the NoMad Hotel, known for exceptional drinks and a gorgeous Art Deco room.', nb: 'Midtown', addr: '10 W 28th St, New York, NY 10001', website: 'https://www.thenomadhotel.com/bar', phone: '(347) 472-5660', ig: 'nomadhotel', tags: ['cocktails', 'upscale', 'hotel bar', 'Manhattan', 'date night', 'Art Deco'], price: 4, rating: 4.5, reviews: 560, source: 'https://www.thenomadhotel.com/bar' },
  { name: 'Hometown Bar-B-Que', desc: 'Texas and Carolina-style BBQ in Red Hook, widely considered NYC\'s best. Long lines, big portions.', nb: 'Sunset Park', addr: '454 Van Brunt St, Brooklyn, NY 11231', website: 'https://hometownbbq.com', phone: '(347) 294-4644', ig: 'hometownbbq', tags: ['BBQ', 'brisket', 'ribs', 'Brooklyn', 'casual', 'family style'], price: 2, rating: 4.7, reviews: 2800, source: 'https://hometownbbq.com' },
  { name: 'Atla', desc: 'Sleek Nolita Mexican from Enrique Olvera — all-day cafe vibes with excellent breakfast tacos and mezcal cocktails.', nb: 'SoHo', addr: '372 Lafayette St, New York, NY 10012', website: 'https://atlanyc.com', phone: '(646) 490-4377', ig: 'atlanyc', tags: ['Mexican', 'brunch', 'mezcal', 'SoHo', 'all-day', 'tacos'], price: 3, rating: 4.4, reviews: 720, source: 'https://atlanyc.com' },
  { name: 'Di Fara Pizza', desc: 'Since 1965, Dom DeMarco has been making NYC\'s most famous pizza by hand. Midwood institution.', nb: 'Flatbush', addr: '1424 Avenue J, Brooklyn, NY 11230', website: 'https://www.difara.com', phone: '(718) 258-1367', ig: null, tags: ['pizza', 'classic', 'Brooklyn', 'cash only', 'institution', 'New York style'], price: 2, rating: 4.7, reviews: 4200, source: 'https://www.difara.com' },
  { name: 'Bunna Cafe', desc: 'Vegan Ethiopian cafe in Bushwick with injera, spice-rich stews, and weekend DJ nights.', nb: 'Bushwick', addr: '1084 Flushing Ave, Brooklyn, NY 11237', website: 'https://bunnacafe.com', phone: '(347) 295-2227', ig: 'bunnacafe', tags: ['Ethiopian', 'vegan', 'Bushwick', 'brunch', 'communal dining', 'spicy'], price: 2, rating: 4.6, reviews: 880, source: 'https://bunnacafe.com' },
  { name: 'Lilia', desc: 'Missy Robbins\' pasta-centric Italian in Williamsburg — the cacio e pepe is legendary. Impossible to get reservations.', nb: 'Williamsburg', addr: '567 Union Ave, Brooklyn, NY 11211', website: 'https://liliarestaurant.com', phone: '(718) 576-3095', ig: 'liliarestaurant', tags: ['Italian', 'pasta', 'Williamsburg', 'upscale', 'romantic', 'cacio e pepe'], price: 4, rating: 4.8, reviews: 1100, source: 'https://liliarestaurant.com' },
  { name: 'Smorgasburg', desc: 'NYC\'s premier open-air food market, held every weekend in Prospect Park (Saturdays) and Williamsburg (Sundays).', nb: 'Williamsburg', addr: 'East River State Park, N 7th St, Brooklyn, NY 11211', website: 'https://www.smorgasburg.com', phone: null, ig: 'smorgasburg', tags: ['market', 'outdoor', 'food hall', 'Brooklyn', 'weekend', 'brunch', 'variety'], price: 2, rating: 4.5, reviews: 6700, source: 'https://www.smorgasburg.com' },
  { name: 'Prince Street Pizza', desc: 'SoHo staple for thick-cut pepperoni squares with crispy tops and a satisfying crunch.', nb: 'SoHo', addr: '27 Prince St, New York, NY 10012', website: 'https://www.princestreetpizza.com', phone: '(212) 966-4100', ig: 'princestreetpizza', tags: ['pizza', 'square slice', 'SoHo', 'pepperoni', 'casual', 'quick lunch'], price: 1, rating: 4.6, reviews: 3100, source: 'https://www.princestreetpizza.com' },
  { name: 'Tanoreen', desc: 'Bay Ridge institution serving outstanding Palestinian and Middle Eastern cuisine. Family-run, generous portions.', nb: 'Bay Ridge', addr: '7523 3rd Ave, Brooklyn, NY 11209', website: 'https://tanoreen.com', phone: '(718) 748-5600', ig: 'tanoreenrestaurant', tags: ['Middle Eastern', 'Palestinian', 'Brooklyn', 'brunch', 'family style', 'mezze'], price: 2, rating: 4.7, reviews: 1500, source: 'https://tanoreen.com' },
]

// ─── Class/Workshop Data ──────────────────────────────────────────────────────

const CLASS_DATA = [
  { name: 'Makeville Studio', desc: 'Brooklyn woodworking studio offering classes for beginners through advanced makers — everything from furniture to small crafts.', nb: 'Gowanus', addr: '232 Third Ave, Brooklyn, NY 11215', website: 'https://makeville.com', phone: '(718) 643-8022', ig: 'makevillestudio', tags: ['woodworking', 'crafts', 'Brooklyn', 'beginner friendly', 'workshop', 'hands-on'], price: 3, rating: 4.8, reviews: 230 },
  { name: 'Brooklyn Boulders LIC', desc: 'Massive indoor climbing gym in Long Island City with bouldering, lead walls, and fitness classes.', nb: 'Long Island City', addr: '24-12 Jackson Ave, Long Island City, NY 11101', website: 'https://brooklynboulders.com/longislandcity', phone: '(347) 834-9066', ig: 'brooklynboulders', tags: ['rock climbing', 'bouldering', 'fitness', 'Queens', 'beginner friendly', 'group classes'], price: 3, rating: 4.5, reviews: 980 },
  { name: 'Croghan Supply Co.', desc: 'Cozy Bushwick ceramics studio with wheel-throwing and hand-building classes for all skill levels.', nb: 'Bushwick', addr: '117 Troutman St, Brooklyn, NY 11206', website: 'https://croghan.studio', phone: null, ig: 'croghansupply', tags: ['ceramics', 'pottery', 'Bushwick', 'hands-on', 'beginner friendly', 'creative'], price: 2, rating: 4.9, reviews: 160 },
  { name: 'Kettlebell Kitchen NYC', desc: 'Small-group strength and conditioning classes in the West Village. Emphasis on technique and community.', nb: 'West Village', addr: '12 W 18th St, New York, NY 10011', website: 'https://kettlebellkitchen.com', phone: '(212) 488-3560', ig: 'kettlebellkitchennyc', tags: ['kettlebell', 'strength training', 'fitness', 'small group', 'West Village', 'HIIT'], price: 3, rating: 4.7, reviews: 320 },
  { name: 'Harlem Textile Works', desc: 'Community weaving and textile arts studio offering classes in hand-weaving, natural dyeing, and fiber arts.', nb: 'Harlem', addr: '168 W 139th St, New York, NY 10030', website: 'https://www.harlemtextileworks.com', phone: '(917) 740-0577', ig: 'harlemtextileworks', tags: ['weaving', 'textile arts', 'Harlem', 'natural dyeing', 'craft', 'creative'], price: 2, rating: 4.8, reviews: 120 },
  { name: 'Astor Center Cooking School', desc: 'Wine and food education venue in NoHo with hands-on cooking classes and wine tasting events.', nb: 'East Village', addr: '399 Lafayette St, New York, NY 10003', website: 'https://astorcenter.com', phone: '(212) 674-7501', ig: 'astorcenter', tags: ['cooking class', 'wine', 'NoHo', 'date night', 'hands-on', 'food education'], price: 3, rating: 4.6, reviews: 480 },
  { name: 'NY Trapeze School', desc: 'Flying trapeze lessons on an outdoor rig over the Hudson River — one of the most unique NYC experiences.', nb: "Hell's Kitchen", addr: 'Pier 40, Hudson St, New York, NY 10014', website: 'https://newyork.trapezeschool.com', phone: '(212) 242-8769', ig: 'trapesecom', tags: ['trapeze', 'circus', 'outdoor', 'unique', "Hell's Kitchen", 'adventure', 'fitness'], price: 3, rating: 4.7, reviews: 1400 },
  { name: 'Brooklyn Brainery', desc: 'Community-run learning cooperative offering low-cost, peer-taught classes on everything from sourdough to philosophy.', nb: 'Prospect Heights', addr: '515 Court St, Brooklyn, NY 11231', website: 'https://brooklynbrainery.com', phone: null, ig: 'brooklynbrainery', tags: ['community', 'learning', 'affordable', 'sourdough', 'DIY', 'Brooklyn', 'workshops'], price: 1, rating: 4.7, reviews: 340 },
  { name: 'Yoga to the People', desc: 'Donation-based yoga studios across the city offering accessible classes for all levels.', nb: 'East Village', addr: '12 St. Marks Pl, New York, NY 10003', website: 'https://www.yogatothepeople.com', phone: null, ig: 'yogatothepeople', tags: ['yoga', 'donation-based', 'accessible', 'all levels', 'East Village', 'community'], price: 1, rating: 4.5, reviews: 1800 },
  { name: 'GlassRoots', desc: 'Harlem-based glassblowing studio offering beginner and intermediate workshops in a stunning space.', nb: 'Harlem', addr: '117 W 124th St, New York, NY 10027', website: 'https://glassroots.org', phone: '(212) 491-2460', ig: 'glassrootsnyc', tags: ['glassblowing', 'Harlem', 'arts', 'hands-on', 'workshop', 'unique'], price: 3, rating: 4.9, reviews: 200 },
  { name: 'The Punching Bag LES', desc: 'Boxing gym on the Lower East Side with expert trainers, group classes, and a welcoming community.', nb: 'Lower East Side', addr: '82 Stanton St, New York, NY 10002', website: 'https://thepunchingbag.com', phone: '(917) 251-8220', ig: 'thepunchingbagles', tags: ['boxing', 'fitness', 'Lower East Side', 'group class', 'welcoming', 'strength'], price: 2, rating: 4.8, reviews: 280 },
  { name: 'Westside Dance Project', desc: 'Contemporary and hip-hop dance studio with classes for adults of all levels, from beginner to pro.', nb: 'Upper West Side', addr: '342 W 71st St, New York, NY 10023', website: 'https://wsdance.org', phone: '(212) 762-8700', ig: 'westsidedance', tags: ['dance', 'hip-hop', 'contemporary', 'Upper West Side', 'adults', 'beginner'], price: 2, rating: 4.6, reviews: 350 },
  { name: 'NYC Enamel Arts', desc: 'Small-group enameling and jewelry-making studio in Midtown, known for incredibly patient instructors.', nb: 'Midtown', addr: '356 W 44th St, New York, NY 10036', website: 'https://nycenamealarts.com', phone: '(212) 397-0790', ig: null, tags: ['jewelry making', 'enamel', 'craft', 'Midtown', 'hands-on', 'creative'], price: 3, rating: 4.7, reviews: 150 },
  { name: 'Balloon Saloon Improv', desc: 'Beginner and advanced improv comedy courses in Tribeca. Relaxed environment, skilled instructors.', nb: 'Tribeca', addr: '133 W Broadway, New York, NY 10013', website: 'https://balloonsaloon.com', phone: '(212) 227-3838', ig: null, tags: ['improv', 'comedy', 'Tribeca', 'class', 'beginner', 'social'], price: 2, rating: 4.6, reviews: 190 },
  { name: 'Ridgewood Art Studios', desc: 'Community artist studios in Ridgewood offering painting, drawing, and printmaking classes for adults.', nb: 'Ridgewood', addr: '60 Onderdonk Ave, Queens, NY 11385', website: 'https://ridgewoodartstudios.com', phone: '(718) 555-0123', ig: 'ridgewoodartstudios', tags: ['painting', 'drawing', 'printmaking', 'Queens', 'adults', 'community art'], price: 2, rating: 4.7, reviews: 110 },
]

// ─── Event Data ───────────────────────────────────────────────────────────────

const EVENT_DATA = [
  { name: 'Brooklyn Night Bazaar', desc: 'Sprawling indoor market in Greenpoint with over 100 local vendors, live music, food trucks, and arcade games.', nb: 'Greenpoint', addr: '165 Banker St, Brooklyn, NY 11222', website: 'https://bkbazaar.com', phone: null, ig: 'bknightbazaar', tags: ['market', 'live music', 'food', 'Brooklyn', 'weekend', 'vendors', 'indoor market'], price: 1, rating: 4.5, reviews: 3200, type: 'market' },
  { name: 'NYC Comedy Festival', desc: 'Annual celebration of stand-up comedy with performers from Comedy Central, Netflix, and HBO across venues citywide.', nb: 'Midtown', addr: 'Multiple NYC venues', website: 'https://nyccomedyfestival.com', phone: null, ig: 'nyccomedyfestival', tags: ['comedy', 'stand-up', 'festival', 'NYC-wide', 'celebrity', 'entertainment'], price: 3, rating: 4.6, reviews: 1100, type: 'show' },
  { name: 'Jazz at Lincoln Center', desc: 'World-class jazz performances at the spectacular Rose Theater, Appel Room, and Dizzy\'s Club.', nb: 'Upper West Side', addr: 'Broadway at 60th St, New York, NY 10023', website: 'https://jazz.org', phone: '(212) 258-9800', ig: 'jazzatlincolncenter', tags: ['jazz', 'live music', 'Lincoln Center', 'upscale', 'Manhattan', 'cultural'], price: 3, rating: 4.8, reviews: 4500, type: 'concert' },
  { name: 'Nitehawk Cinema', desc: 'Williamsburg\'s beloved dine-in cinema showing indie films, cult classics, and special events with food and cocktails.', nb: 'Williamsburg', addr: '136 Metropolitan Ave, Brooklyn, NY 11249', website: 'https://nitehawkcinema.com', phone: '(718) 782-8370', ig: 'nitehawkcinema', tags: ['cinema', 'indie film', 'dine-in', 'Williamsburg', 'date night', 'cocktails'], price: 2, rating: 4.7, reviews: 2800, type: 'show' },
  { name: 'MoMA PS1 Warm Up', desc: 'Iconic summer DJ party series in the PS1 courtyard — one of NYC\'s best outdoor music events.', nb: 'Long Island City', addr: '22-25 Jackson Ave, Long Island City, NY 11101', website: 'https://www.moma.org/ps1/programs/warm-up', phone: '(718) 784-2084', ig: 'momaps1', tags: ['DJ', 'outdoor', 'art', 'Queens', 'summer', 'electronic music', 'party'], price: 2, rating: 4.7, reviews: 5200, type: 'party' },
  { name: 'Brooklyn Museum First Saturdays', desc: 'Free monthly events at Brooklyn Museum with art, music, dancing, and film every first Saturday of the month.', nb: 'Prospect Heights', addr: '200 Eastern Pkwy, Brooklyn, NY 11238', website: 'https://www.brooklynmuseum.org/programs/first-saturdays', phone: '(718) 638-5000', ig: 'brooklynmuseum', tags: ['museum', 'free', 'art', 'Brooklyn', 'monthly', 'dancing', 'family'], price: 1, rating: 4.8, reviews: 7100, type: 'exhibit' },
  { name: 'Drag Brunch at Lips NYC', desc: 'Outrageous drag brunch with live performances, bottomless mimosas, and a party vibe you won\'t forget.', nb: 'Midtown', addr: '227 E 56th St, New York, NY 10022', website: 'https://lipsnyc.com', phone: '(212) 675-7710', ig: 'lipsnyc', tags: ['drag', 'brunch', 'LGBTQ+', 'Midtown', 'bottomless', 'live performance', 'party'], price: 3, rating: 4.4, reviews: 1400, type: 'show' },
  { name: 'Bushwick Collective Block Party', desc: 'Annual outdoor street art festival in Bushwick celebrating the neighborhood\'s famous outdoor murals with live music and vendors.', nb: 'Bushwick', addr: 'Troutman St & St Nicholas Ave, Brooklyn, NY 11237', website: 'https://thebushwickcollective.com', phone: null, ig: 'thebushwickcollective', tags: ['street art', 'outdoor', 'Bushwick', 'live music', 'free', 'community', 'festival'], price: 1, rating: 4.7, reviews: 3800, type: 'party' },
  { name: 'Rough Trade NYC', desc: 'Legendary record store in Williamsburg with an intimate venue hosting emerging and established artists.', nb: 'Williamsburg', addr: '64 N 9th St, Brooklyn, NY 11249', website: 'https://roughtraderecords.com/pages/nyc', phone: '(718) 388-4111', ig: 'roughtradenyc', tags: ['live music', 'indie', 'record store', 'Williamsburg', 'intimate venue', 'concerts'], price: 2, rating: 4.8, reviews: 1600, type: 'concert' },
  { name: 'The Met Rooftop Bar & Garden', desc: 'Seasonal rooftop bar atop the Metropolitan Museum offering cocktails and sweeping Central Park views.', nb: 'Upper East Side', addr: '1000 5th Ave, New York, NY 10028', website: 'https://www.metmuseum.org/plan-your-visit/dining', phone: '(212) 535-7710', ig: 'metmuseum', tags: ['rooftop', 'cocktails', 'Upper East Side', 'seasonal', 'views', 'upscale', 'museum'], price: 4, rating: 4.7, reviews: 2900, type: 'exhibit' },
  { name: 'Club Cumming', desc: 'Alan Cumming\'s East Village cabaret bar with eclectic programming — drag, music, comedy, and more.', nb: 'East Village', addr: '505 E 6th St, New York, NY 10009', website: 'https://clubcumming.com', phone: '(646) 850-9029', ig: 'clubcumming', tags: ['cabaret', 'drag', 'LGBTQ+', 'East Village', 'live music', 'cocktails', 'late night'], price: 2, rating: 4.7, reviews: 1200, type: 'show' },
  { name: 'The Bell House', desc: 'Gowanus venue with an eclectic lineup of indie concerts, comedy, quiz nights, and special events in a converted factory.', nb: 'Park Slope', addr: '149 7th St, Brooklyn, NY 11215', website: 'https://thebellhouseny.com', phone: '(718) 643-6510', ig: 'thebellhouseny', tags: ['live music', 'indie', 'comedy', 'Brooklyn', 'quiz night', 'concert venue'], price: 2, rating: 4.6, reviews: 2100, type: 'concert' },
  { name: 'Artists & Fleas', desc: 'Weekend market in Chelsea Market featuring local designers, artists, and vintage collectors.', nb: 'Chelsea', addr: '75 9th Ave, New York, NY 10011', website: 'https://www.artistsandfleas.com', phone: '(917) 488-1978', ig: 'artistsandfleas', tags: ['market', 'artisan', 'Chelsea', 'vintage', 'local designers', 'weekend', 'shopping'], price: 1, rating: 4.5, reviews: 2300, type: 'market' },
  { name: 'House of Yes', desc: 'Bushwick\'s beloved arts venue and nightclub with themed parties, aerial acrobatics, and unforgettable experiences.', nb: 'Bushwick', addr: '2 Wyckoff Ave, Brooklyn, NY 11237', website: 'https://houseofyes.org', phone: '(347) 678-5882', ig: 'houseofyes', tags: ['nightclub', 'arts', 'Bushwick', 'themed party', 'dancing', 'acrobatics', 'LGBTQ+'], price: 2, rating: 4.8, reviews: 4700, type: 'party' },
  { name: 'Astronomy on Tap NYC', desc: 'Monthly bar-based astronomy talks — real scientists discuss space science in an approachable setting.', nb: 'Williamsburg', addr: 'Rockwell Place, Brooklyn, NY 11217', website: 'https://astronomyontap.org/locations/new-york', phone: null, ig: 'astronomyontap', tags: ['science', 'astronomy', 'bar talk', 'free', 'monthly', 'Brooklyn', 'education'], price: 1, rating: 4.8, reviews: 420, type: 'show' },
  { name: 'Union Hall Brooklyn', desc: 'Park Slope bar with bocce courts, live music, comedy, and a cozy library downstairs. Quintessential Brooklyn.', nb: 'Park Slope', addr: '702 Union St, Brooklyn, NY 11215', website: 'https://unionhallny.com', phone: '(718) 638-4400', ig: 'unionhallny', tags: ['bar', 'bocce', 'live music', 'comedy', 'Brooklyn', 'Park Slope', 'cozy'], price: 2, rating: 4.5, reviews: 1700, type: 'show' },
]

// ─── Additional real NYC entities ─────────────────────────────────────────────

const ADDITIONAL_ENTITY_DATA: Array<{
  name: string; type: string; nb: string; addr: string; website: string;
  phone: string | null; ig: string | null; tags: string[]; price: number;
  rating: number; reviews: number; desc: string;
}> = [
  // ── More Restaurants ──
  { name: 'Balthazar', type: 'restaurant', nb: 'SoHo', addr: '80 Spring St, New York, NY 10012', website: 'https://www.balthazarny.com', phone: '(212) 965-1785', ig: 'balthazarny', tags: ['French', 'brasserie', 'brunch', 'SoHo', 'date night', 'classic'], price: 3, rating: 4.4, reviews: 4200, desc: 'Iconic SoHo brasserie with a stunning interior, excellent raw bar, and quintessential New York brunch.' },
  { name: 'Carbone', type: 'restaurant', nb: 'West Village', addr: '181 Thompson St, New York, NY 10012', website: 'https://carbonenewyork.com', phone: '(212) 254-3000', ig: 'carbonenewyork', tags: ['Italian-American', 'fine dining', 'West Village', 'date night', 'pasta', 'celebrity spot'], price: 4, rating: 4.6, reviews: 2100, desc: "Mario Carbone's glamorous retro-Italian restaurant serving legendary spicy rigatoni and tableside Caesar." },
  { name: 'Via Carota', type: 'restaurant', nb: 'West Village', addr: '51 Grove St, New York, NY 10014', website: 'https://www.viacarota.com', phone: '(212) 255-1962', ig: 'viacarota', tags: ['Italian', 'rustic', 'West Village', 'seasonal', 'romantic', 'no reservations'], price: 3, rating: 4.7, reviews: 3100, desc: 'Beloved West Village trattoria by Jody Williams and Rita Sodi. The insalata verde is the stuff of legend.' },
  { name: 'Frenchette', type: 'restaurant', nb: 'Tribeca', addr: '241 W Broadway, New York, NY 10013', website: 'https://www.frenchettenyc.com', phone: '(212) 334-3883', ig: 'frenchettenyc', tags: ['French', 'bistro', 'Tribeca', 'natural wine', 'date night', 'James Beard'], price: 3, rating: 4.6, reviews: 980, desc: 'James Beard Award-winning Tribeca bistro with offbeat French classics and a serious natural wine list.' },
  { name: 'The River Café', type: 'restaurant', nb: 'DUMBO', addr: '1 Water St, Brooklyn, NY 11201', website: 'https://www.rivercafe.com', phone: '(718) 522-5200', ig: 'rivercafebk', tags: ['American', 'fine dining', 'DUMBO', 'views', 'romantic', 'special occasion'], price: 4, rating: 4.6, reviews: 2400, desc: 'Iconic DUMBO restaurant beneath the Brooklyn Bridge with unparalleled Manhattan skyline views and elegant New American cuisine.' },
  { name: 'Peter Luger Steak House', type: 'restaurant', nb: 'Williamsburg', addr: '178 Broadway, Brooklyn, NY 11211', website: 'https://peterluger.com', phone: '(718) 387-7400', ig: 'peterlugersteakhouse', tags: ['steakhouse', 'porterhouse', 'Williamsburg', 'cash only', 'classic NYC', 'institution'], price: 4, rating: 4.5, reviews: 6800, desc: "Since 1887, New York's most famous steakhouse. The dry-aged porterhouse is legendary. Cash only." },
  { name: 'Gage & Tollner', type: 'restaurant', nb: 'DUMBO', addr: '372 Fulton St, Brooklyn, NY 11201', website: 'https://gageandtollner.com', phone: '(718) 813-8630', ig: 'gageandtollner', tags: ['American', 'brasserie', 'Brooklyn', 'oysters', 'cocktails', 'historic'], price: 3, rating: 4.6, reviews: 760, desc: 'Revived 1879 Brooklyn institution with flambeed cocktails, oysters, and steakhouse classics in a stunning gas-lit dining room.' },
  { name: 'L&B Spumoni Gardens', type: 'restaurant', nb: 'Sunset Park', addr: '2725 86th St, Brooklyn, NY 11223', website: 'https://spumonigardens.com', phone: '(718) 449-1230', ig: 'lbspumonigardens', tags: ['pizza', 'Sicilian', 'Brooklyn', 'cash only', 'institution', 'outdoor'], price: 1, rating: 4.6, reviews: 5400, desc: 'Brooklyn institution since 1939 famous for thick-cut Sicilian pizza and their legendary spumoni ice cream.' },
  { name: 'Emmy Squared', type: 'restaurant', nb: 'Williamsburg', addr: '364 Grand St, Brooklyn, NY 11211', website: 'https://emmyrestaurant.com', phone: '(718) 360-4535', ig: 'emmysquared', tags: ['Detroit pizza', 'Williamsburg', 'smash burger', 'casual', 'date night'], price: 2, rating: 4.5, reviews: 2300, desc: 'Williamsburg pizzeria specializing in Detroit-style square pies with crispy caramelized edges and smash burgers.' },
  { name: 'Emily', type: 'restaurant', nb: 'West Village', addr: '35 Downing St, New York, NY 10014', website: 'https://pizzalovesemily.com', phone: '(212) 996-1996', ig: 'pizzalovesemily', tags: ['pizza', 'West Village', 'burgers', 'casual', 'date night'], price: 2, rating: 4.5, reviews: 1800, desc: "West Village pizza spot famous for their Colony pizza and Emmy burger — some of NYC's best." },
  { name: "L'Artusi", type: 'restaurant', nb: 'West Village', addr: '228 W 10th St, New York, NY 10014', website: 'https://lartusi.com', phone: '(212) 255-5757', ig: 'lartusi', tags: ['Italian', 'pasta', 'West Village', 'natural wine', 'date night', 'upscale'], price: 3, rating: 4.6, reviews: 1400, desc: 'Sophisticated West Village Italian with handmade pasta, natural wines, and one of NYC\'s best dining-room vibes.' },
  { name: "Joe's Pizza", type: 'restaurant', nb: 'West Village', addr: '7 Carmine St, New York, NY 10014', website: 'https://joespizzanyc.com', phone: '(212) 366-1182', ig: 'joespizzanyc', tags: ['pizza', 'NY slice', 'West Village', 'cash', 'classic', 'quick bite'], price: 1, rating: 4.5, reviews: 8900, desc: "NYC's most iconic slice shop. Thin, crispy, perfectly cheesy New York-style pizza since 1975." },
  { name: 'Prune', type: 'restaurant', nb: 'East Village', addr: '54 E 1st St, New York, NY 10003', website: 'https://prunerestaurant.com', phone: '(212) 677-6221', ig: 'prunerestaurant', tags: ['American', 'East Village', 'brunch', 'intimate', 'seasonal', 'classic'], price: 3, rating: 4.6, reviews: 1100, desc: "Gabrielle Hamilton's beloved East Village bistro — intimate, soulful, and one of the best brunches in the city." },
  { name: 'Estela', type: 'restaurant', nb: 'SoHo', addr: '47 E Houston St, New York, NY 10012', website: 'https://estelanyc.com', phone: '(212) 219-7693', ig: 'estelanyc', tags: ['Mediterranean', 'sharing plates', 'SoHo', 'natural wine', 'date night', 'upscale'], price: 3, rating: 4.7, reviews: 1600, desc: "Ignacio Mattos's Mediterranean-influenced small plates restaurant — creative, precise, and consistently excellent." },
  { name: 'Gramercy Tavern', type: 'restaurant', nb: 'Flatiron', addr: '42 E 20th St, New York, NY 10003', website: 'https://www.gramercytavern.com', phone: '(212) 477-0777', ig: 'gramercytavern', tags: ['American', 'Flatiron', 'fine dining', 'seasonal', 'flowers', 'classic NYC'], price: 4, rating: 4.7, reviews: 3200, desc: "Danny Meyer's landmark New American with exquisite seasonal menus, gorgeous floral decor, and impeccable hospitality." },
  { name: 'The Dutch', type: 'restaurant', nb: 'SoHo', addr: '131 Sullivan St, New York, NY 10012', website: 'https://www.thedutchnyc.com', phone: '(212) 677-6200', ig: 'thedutchnyc', tags: ['American', 'brunch', 'SoHo', 'oysters', 'cocktails', 'all-day'], price: 3, rating: 4.4, reviews: 2600, desc: "Andrew Carmellini's SoHo all-day American with oysters, lobster rolls, and one of NYC's best boozy brunches." },
  { name: 'Minetta Tavern', type: 'restaurant', nb: 'West Village', addr: '113 MacDougal St, New York, NY 10012', website: 'https://minettatavernny.com', phone: '(212) 475-3850', ig: 'minettatavernny', tags: ['French', 'steak', 'West Village', 'burgers', 'date night', 'classic'], price: 3, rating: 4.5, reviews: 2100, desc: "McNally's West Village brasserie famous for the Black Label Burger and impeccably sourced dry-aged beef." },
  { name: 'Mission Chinese Food', type: 'restaurant', nb: 'Lower East Side', addr: '171 E Broadway, New York, NY 10002', website: 'https://missionchinesefood.com', phone: '(917) 376-6430', ig: 'missionchinesefood', tags: ['Chinese', 'spicy', 'Lower East Side', 'creative', 'late night', 'cult favorite'], price: 2, rating: 4.3, reviews: 2800, desc: "Danny Bowien's irreverent Chinese-American with fiery Sichuan-influenced dishes in a loud, fun atmosphere." },
  { name: 'Diner', type: 'restaurant', nb: 'Williamsburg', addr: '85 Broadway, Brooklyn, NY 11249', website: 'https://dinernyc.com', phone: '(718) 486-3077', ig: 'diner_nyc', tags: ['American', 'Williamsburg', 'natural wine', 'seasonal', 'no menu', 'hip'], price: 2, rating: 4.4, reviews: 1700, desc: "Williamsburg's beloved no-menu restaurant in a repurposed dining car — seasonal American with a great natural wine list." },
  { name: 'Motorino', type: 'restaurant', nb: 'East Village', addr: '349 E 12th St, New York, NY 10003', website: 'https://motorinopizza.com', phone: '(212) 777-2644', ig: 'motorinopizza', tags: ['Neapolitan pizza', 'East Village', 'wood-fired', 'Italian', 'casual'], price: 2, rating: 4.5, reviews: 2200, desc: 'Outstanding Neapolitan pizza in the East Village with a wood-burning oven and stellar seasonal toppings.' },
  { name: 'The Four Horsemen', type: 'restaurant', nb: 'Williamsburg', addr: '295 Grand St, Brooklyn, NY 11211', website: 'https://thefourhorsemenny.com', phone: '(718) 599-4900', ig: 'thefourhorsemen', tags: ['natural wine', 'Williamsburg', 'small plates', 'hip', 'date night'], price: 3, rating: 4.6, reviews: 890, desc: "James Murphy's (LCD Soundsystem) natural wine bar with inventive small plates in a beautiful Williamsburg space." },
  { name: 'Insa', type: 'restaurant', nb: 'Gowanus', addr: '328 Douglass St, Brooklyn, NY 11217', website: 'https://insabrooklyn.com', phone: '(718) 855-2620', ig: 'insabrooklyn', tags: ['Korean BBQ', 'Gowanus', 'karaoke', 'late night', 'group dinner', 'fun'], price: 2, rating: 4.6, reviews: 1400, desc: 'Korean BBQ restaurant with built-in karaoke rooms in Gowanus — a perfect group night out.' },
  { name: 'Il Buco', type: 'restaurant', nb: 'NoHo', addr: '47 Bond St, New York, NY 10012', website: 'https://ilbuco.com', phone: '(212) 533-1932', ig: 'ilbuco', tags: ['Italian', 'Mediterranean', 'NoHo', 'romantic', 'date night', 'rustic'], price: 3, rating: 4.6, reviews: 1300, desc: 'Antique-filled NoHo gem with rustic Italian-Mediterranean cuisine, great pasta, and an excellent wine cellar.' },
  { name: "Frankie's 457 Spuntino", type: 'restaurant', nb: 'Carroll Gardens', addr: '457 Court St, Brooklyn, NY 11231', website: 'https://frankiesspuntino.com', phone: '(718) 403-0033', ig: 'frankies457', tags: ['Italian', 'Carroll Gardens', 'garden', 'casual', 'Brooklyn', 'meatballs'], price: 2, rating: 4.5, reviews: 2800, desc: 'Neighborhood Italian staple with a beautiful backyard garden, killer cacio e pepe, and housemade meatballs.' },
  { name: "Bamonte's", type: 'restaurant', nb: 'Williamsburg', addr: '32 Withers St, Brooklyn, NY 11211', website: 'https://bamontesny.com', phone: '(718) 384-8831', ig: 'bamontesrestaurant', tags: ['Italian', 'Williamsburg', 'old school', 'classic', 'red sauce', 'cash only'], price: 2, rating: 4.5, reviews: 1500, desc: 'Old-school Italian institution in Williamsburg since 1900 — checkered tablecloths, red sauce, and no-frills classics.' },
  { name: 'Dirt Candy', type: 'restaurant', nb: 'Lower East Side', addr: '86 Allen St, New York, NY 10002', website: 'https://dirtcandynyc.com', phone: '(212) 228-7732', ig: 'dirtcandynyc', tags: ['vegetarian', 'Lower East Side', 'creative', 'tasting menu', 'innovative', 'fine dining'], price: 3, rating: 4.6, reviews: 820, desc: "Amanda Cohen's acclaimed vegetable-focused restaurant proving plant-based cuisine can be exciting and indulgent." },
  { name: 'Momofuku Noodle Bar', type: 'restaurant', nb: 'East Village', addr: '171 1st Ave, New York, NY 10003', website: 'https://momofuku.com/new-york/noodle-bar', phone: '(212) 777-7773', ig: 'momofuku', tags: ['noodles', 'ramen', 'East Village', 'David Chang', 'casual', 'pork buns'], price: 2, rating: 4.4, reviews: 3700, desc: "David Chang's original East Village noodle shop — the pork belly steamed buns and ramen remain iconic." },
  { name: 'Han Dynasty', type: 'restaurant', nb: 'East Village', addr: '90 3rd Ave, New York, NY 10003', website: 'https://handynasty.net', phone: '(212) 390-8685', ig: 'handynasty', tags: ['Sichuan', 'spicy', 'East Village', 'dan dan noodles', 'Chinese', 'casual'], price: 2, rating: 4.4, reviews: 2100, desc: 'Authentic Sichuan cuisine with fiery dan dan noodles and ma po tofu that actually numbs your mouth.' },
  { name: 'Nan Xiang Xiao Long Bao', type: 'restaurant', nb: 'Flushing', addr: '38-12 Prince St, Flushing, NY 11354', website: 'https://nanxiangusa.com', phone: '(718) 321-3838', ig: 'nanxiangxlb', tags: ['soup dumplings', 'XLB', 'Flushing', 'Chinese', 'Queens', 'must try'], price: 1, rating: 4.5, reviews: 4800, desc: "Flushing's destination for Shanghai-style soup dumplings — thin-skinned, juicy, and served piping hot." },
  { name: 'Cote Korean Steakhouse', type: 'restaurant', nb: 'Flatiron', addr: '16 W 22nd St, New York, NY 10010', website: 'https://cotenyc.com', phone: '(212) 401-7986', ig: 'cotenyc', tags: ['Korean BBQ', 'steakhouse', 'Flatiron', 'upscale', 'date night', 'USDA prime'], price: 4, rating: 4.7, reviews: 1600, desc: 'Michelin-starred Korean steakhouse blending American and Korean BBQ traditions with prime USDA beef.' },
  { name: 'Red Rooster Harlem', type: 'restaurant', nb: 'Harlem', addr: '310 Lenox Ave, New York, NY 10027', website: 'https://www.redroosterharlem.com', phone: '(212) 792-9001', ig: 'redroosterharlem', tags: ['Southern', 'American', 'Harlem', 'brunch', 'live music', 'Marcus Samuelsson'], price: 3, rating: 4.4, reviews: 2200, desc: "Marcus Samuelsson's Harlem landmark celebrating Southern American cuisine with gospel brunch and live jazz." },
  { name: "Sylvia's Restaurant", type: 'restaurant', nb: 'Harlem', addr: '328 Lenox Ave, New York, NY 10027', website: 'https://sylviasrestaurant.com', phone: '(212) 996-0660', ig: 'sylviasrestaurant', tags: ['soul food', 'Harlem', 'Southern', 'fried chicken', 'classic', 'institution'], price: 2, rating: 4.3, reviews: 3100, desc: 'The Queen of Soul Food since 1962. Harlem institution known for fried chicken, waffles, and smothered pork chops.' },
  { name: 'Oxalis', type: 'restaurant', nb: 'Prospect Heights', addr: '791 Washington Ave, Brooklyn, NY 11238', website: 'https://oxalisnyc.com', phone: '(347) 627-8298', ig: 'oxalisnyc', tags: ['New American', 'Prospect Heights', 'tasting menu', 'seasonal', 'intimate', 'wine'], price: 4, rating: 4.8, reviews: 420, desc: 'Intimate Prospect Heights tasting menu restaurant with a focus on seasonal, locally sourced ingredients.' },
  { name: 'Laser Wolf', type: 'restaurant', nb: 'Williamsburg', addr: '97 Wythe Ave, Brooklyn, NY 11249', website: 'https://laserwolfnyc.com', phone: '(718) 384-4666', ig: 'laserwolfnyc', tags: ['Israeli', 'charcoal grill', 'Williamsburg', 'rooftop', 'skewers', 'mezze'], price: 3, rating: 4.6, reviews: 780, desc: "Michael Solomonov's rooftop Israeli charcoal grill in Williamsburg with salatim, laffa, and fire-kissed skewers." },
  { name: 'Aska', type: 'restaurant', nb: 'Williamsburg', addr: '47 S 5th St, Brooklyn, NY 11249', website: 'https://askanyc.com', phone: '(718) 388-2969', ig: 'askanyc', tags: ['Nordic', 'tasting menu', 'Williamsburg', 'Michelin star', 'fine dining', 'foraging'], price: 4, rating: 4.8, reviews: 340, desc: 'Two Michelin star Nordic tasting menu in Williamsburg — moody, precise, and genuinely one of NYC\'s best.' },
  { name: 'Atoboy', type: 'restaurant', nb: 'Flatiron', addr: '43 E 28th St, New York, NY 10016', website: 'https://atoboynyc.com', phone: '(646) 476-7217', ig: 'atoboy_nyc', tags: ['Korean', 'small plates', 'Flatiron', 'modern', 'wine', 'creative'], price: 3, rating: 4.6, reviews: 890, desc: 'Modern Korean small plates by chef Junghyun Park — elegant, inventive, and one of the best values in fine dining.' },
  { name: 'Blue Ribbon Brasserie', type: 'restaurant', nb: 'SoHo', addr: '97 Sullivan St, New York, NY 10012', website: 'https://www.blueribbonrestaurants.com/brasserie', phone: '(212) 274-0404', ig: 'blueribbonnyc', tags: ['American', 'SoHo', 'late night', 'oysters', 'fried chicken', 'classic'], price: 3, rating: 4.4, reviews: 2700, desc: "The original Blue Ribbon — chefs' go-to for post-shift fried chicken, matzo ball soup, and raw bar until 4am." },
  { name: "Bubby's", type: 'restaurant', nb: 'Tribeca', addr: '120 Hudson St, New York, NY 10013', website: 'https://bubbys.com', phone: '(212) 219-0666', ig: 'bubbysnyc', tags: ['American', 'brunch', 'Tribeca', 'pie', 'comfort food', 'all-day'], price: 2, rating: 4.2, reviews: 3400, desc: 'Tribeca comfort food classic famous for weekend brunch, homemade pies, and genuine Southern-inflected cooking.' },
  { name: "Juliana's Pizza", type: 'restaurant', nb: 'DUMBO', addr: '19 Old Fulton St, Brooklyn, NY 11201', website: 'https://julianaspizza.com', phone: '(718) 596-6700', ig: 'julianaspizza', tags: ['pizza', 'DUMBO', 'coal-fired', 'Brooklyn', 'classic', 'lines'], price: 2, rating: 4.6, reviews: 5200, desc: "Patsy Grimaldi's coal-oven pizza in DUMBO — some claim this is the best pie in New York City." },
  { name: 'Miss Ada', type: 'restaurant', nb: 'Fort Greene', addr: '184 DeKalb Ave, Brooklyn, NY 11205', website: 'https://missadabrooklyn.com', phone: '(718) 643-5020', ig: 'missadabrooklyn', tags: ['Middle Eastern', 'Israeli', 'Fort Greene', 'brunch', 'garden', 'mezze'], price: 2, rating: 4.7, reviews: 980, desc: 'Israeli-inspired dishes from chef Tomer Blechman in a cozy Fort Greene space with a dreamy back garden.' },
  { name: 'Bien Cuit', type: 'restaurant', nb: 'Cobble Hill', addr: '120 Smith St, Brooklyn, NY 11201', website: 'https://biencuit.com', phone: '(718) 852-0200', ig: 'biencuitbakery', tags: ['bakery', 'Cobble Hill', 'bread', 'pastry', 'breakfast', 'coffee'], price: 1, rating: 4.7, reviews: 1200, desc: 'Acclaimed artisan bakery with slow-fermented breads, beautiful pastries, and excellent coffee.' },
  { name: 'Sottocasa', type: 'restaurant', nb: 'Prospect Heights', addr: '298 Atlantic Ave, Brooklyn, NY 11201', website: 'https://sottocasanyc.com', phone: '(718) 834-8277', ig: 'sottocasapizza', tags: ['Neapolitan pizza', 'Prospect Heights', 'Italian', 'BYOB', 'casual'], price: 2, rating: 4.5, reviews: 1400, desc: 'Authentic Neapolitan pizza in Brooklyn with a DOC-certified oven, lovely seasonal toppings, and BYOB.' },
  { name: "Roman's", type: 'restaurant', nb: 'Fort Greene', addr: '243 DeKalb Ave, Brooklyn, NY 11205', website: 'https://romansnyc.com', phone: '(718) 622-5300', ig: 'romansfortgreene', tags: ['Italian', 'Fort Greene', 'seasonal', 'pasta', 'local', 'neighborhood gem'], price: 3, rating: 4.6, reviews: 760, desc: 'Neighborhood Italian in Fort Greene with a daily-changing menu of seasonal pasta and vegetables.' },
  { name: "Cervo's", type: 'restaurant', nb: 'Lower East Side', addr: '43 Canal St, New York, NY 10002', website: 'https://cervosnyc.com', phone: '(212) 274-0025', ig: 'cervosnyc', tags: ['Portuguese', 'seafood', 'Lower East Side', 'wine bar', 'tinned fish', 'casual'], price: 2, rating: 4.6, reviews: 840, desc: 'Sun-bleached Portuguese-inspired wine bar on the Lower East Side with excellent tinned fish and grilled seafood.' },
  { name: 'King', type: 'restaurant', nb: 'Hudson Square', addr: '18 King St, New York, NY 10014', website: 'https://king-restaurant.com', phone: '(212) 255-1224', ig: 'kingrestaurant', tags: ['Mediterranean', 'French', 'West Village', 'seasonal', 'natural wine', 'intimate'], price: 3, rating: 4.7, reviews: 720, desc: 'Intimate Mediterranean-inflected restaurant with a rotating menu driven by the market and an outstanding natural wine list.' },
  { name: 'Buvette', type: 'restaurant', nb: 'West Village', addr: '42 Grove St, New York, NY 10014', website: 'https://ilovebuvette.com', phone: '(212) 255-3590', ig: 'ilovebuvette', tags: ['French', 'wine bar', 'West Village', 'brunch', 'cozy', 'romantic'], price: 2, rating: 4.5, reviews: 2600, desc: "Jody Williams's West Village gastrotèque — perfect for wine, croque monsieur, and French cafe vibes all day." },
  { name: 'Zoma', type: 'restaurant', nb: 'Harlem', addr: '2084 Frederick Douglass Blvd, New York, NY 10026', website: 'https://zomanyc.com', phone: '(212) 662-0620', ig: 'zomanyc', tags: ['Ethiopian', 'Harlem', 'vegan friendly', 'injera', 'communal', 'BYOB'], price: 2, rating: 4.6, reviews: 940, desc: 'Upscale Ethiopian cuisine in Harlem with beautifully plated stews, injera, and vegetarian-friendly dishes.' },

  // ── More Classes / Workshops ──
  { name: 'The Brooklyn Kitchen', type: 'class', nb: 'Williamsburg', addr: '100 Frost St, Brooklyn, NY 11211', website: 'https://thebrooklynkitchen.com', phone: '(718) 389-2982', ig: 'thebrooklynkitchen', tags: ['cooking', 'knife skills', 'Williamsburg', 'hands-on', 'beginner', 'butchery'], price: 3, rating: 4.7, reviews: 560, desc: 'Brooklyn cooking school and kitchen supply store offering hands-on cooking classes from butchery to pasta-making.' },
  { name: 'Institute of Culinary Education', type: 'class', nb: 'Chelsea', addr: '225 Liberty St, New York, NY 10281', website: 'https://www.ice.edu', phone: '(212) 847-0700', ig: 'iceculinary', tags: ['culinary', 'professional', 'hands-on', 'Chelsea', 'wine education', 'baking'], price: 3, rating: 4.7, reviews: 890, desc: "NYC's premier culinary school offering recreational cooking and baking classes for all skill levels in a professional setting." },
  { name: 'The League of Kitchens', type: 'class', nb: 'Upper East Side', addr: 'Various locations, New York, NY', website: 'https://www.leagueofkitchens.com', phone: null, ig: 'leagueofkitchens', tags: ['cultural cooking', 'home cooks', 'diverse', 'intimate', 'authentic', 'NYC'], price: 3, rating: 4.9, reviews: 380, desc: 'Intimate cooking workshops taught by immigrant home cooks in their NYC apartments — unforgettably authentic.' },
  { name: 'Urban Glass', type: 'class', nb: 'Fort Greene', addr: '647 Fulton St, Brooklyn, NY 11217', website: 'https://www.urbanglass.org', phone: '(718) 625-3685', ig: 'urbanglassbk', tags: ['glassblowing', 'glass art', 'Fort Greene', 'hands-on', 'studio access', 'beginner'], price: 3, rating: 4.8, reviews: 280, desc: 'Open-access glass art studio offering flameworking, glassblowing, and casting workshops in Fort Greene.' },
  { name: 'Center for Book Arts', type: 'class', nb: 'Chelsea', addr: '28 W 27th St, 3rd Floor, New York, NY 10001', website: 'https://centerforbookarts.org', phone: '(212) 481-0295', ig: 'centerforbookarts', tags: ['bookbinding', 'letterpress', 'Chelsea', 'craft', 'hands-on', 'printing'], price: 2, rating: 4.8, reviews: 170, desc: 'Chelsea studio offering letterpress printing, bookbinding, and paper arts workshops for all skill levels.' },
  { name: 'Textile Arts Center', type: 'class', nb: 'Gowanus', addr: '505 Carroll St, Brooklyn, NY 11215', website: 'https://textileartscenter.com', phone: '(212) 500-2112', ig: 'textileartscenter', tags: ['weaving', 'textile', 'Gowanus', 'natural dye', 'fiber arts', 'hands-on'], price: 2, rating: 4.8, reviews: 210, desc: 'Brooklyn textile studio with loom weaving, natural dyeing, and fiber arts workshops in a beautiful Gowanus space.' },
  { name: 'Pioneer Works', type: 'class', nb: 'Red Hook', addr: '159 Pioneer St, Brooklyn, NY 11231', website: 'https://pioneerworks.org', phone: '(718) 596-3001', ig: 'pioneerworks', tags: ['arts', 'science', 'Red Hook', 'workshops', 'interdisciplinary', 'community'], price: 2, rating: 4.8, reviews: 640, desc: 'Red Hook cultural center merging arts, science, and education with residencies, workshops, and open studios.' },
  { name: 'NYC Pottery', type: 'class', nb: 'SoHo', addr: '7 Wooster St, New York, NY 10013', website: 'https://www.nycpottery.com', phone: '(917) 580-8558', ig: 'nycpottery', tags: ['pottery', 'wheel throwing', 'SoHo', 'beginner', 'date night', 'craft'], price: 3, rating: 4.8, reviews: 460, desc: 'SoHo pottery studio offering beginner wheel-throwing sessions and multi-week courses — great for date nights.' },
  { name: 'Steps on Broadway', type: 'class', nb: 'Upper West Side', addr: '2121 Broadway, New York, NY 10023', website: 'https://www.stepsnyc.com', phone: '(212) 874-2410', ig: 'stepsonbroadway', tags: ['dance', 'ballet', 'jazz', 'Upper West Side', 'professional', 'adults'], price: 2, rating: 4.6, reviews: 820, desc: 'Legendary Upper West Side dance studio with classes in ballet, jazz, hip-hop, and contemporary for all levels.' },
  { name: 'Broadway Dance Center', type: 'class', nb: 'Midtown', addr: '322 W 45th St, New York, NY 10036', website: 'https://broadwaydancecenter.com', phone: '(212) 582-9304', ig: 'bdcnyc', tags: ['dance', 'hip-hop', 'Broadway', 'jazz', 'Midtown', 'professional'], price: 2, rating: 4.6, reviews: 940, desc: "Midtown's premier dance studio offering classes in hip-hop, jazz, Latin, and contemporary for adults." },
  { name: 'Peridance Centre', type: 'class', nb: 'East Village', addr: '126 E 13th St, New York, NY 10003', website: 'https://peridance.com', phone: '(212) 505-0886', ig: 'peridancecenter', tags: ['dance', 'contemporary', 'East Village', 'ballet', 'adults', 'professional'], price: 2, rating: 4.7, reviews: 420, desc: 'East Village dance center offering contemporary, ballet, and world dance classes with world-class instructors.' },
  { name: 'Mark Fisher Fitness', type: 'class', nb: 'Chelsea', addr: '138 W 25th St, New York, NY 10001', website: 'https://markfisherfitness.com', phone: '(212) 675-6590', ig: 'markfisherfitness', tags: ['fitness', 'Chelsea', 'LGBTQ+ friendly', 'inclusive', 'strength', 'community'], price: 3, rating: 4.9, reviews: 380, desc: "Chelsea's most inclusive fitness community — known for their 'ninjas' gym culture and welcoming LGBTQ+ environment." },
  { name: 'Mile High Run Club', type: 'class', nb: 'Flatiron', addr: '28 E 22nd St, New York, NY 10010', website: 'https://themilehighrunclub.com', phone: '(212) 673-4747', ig: 'milehighrunclub', tags: ['running', 'treadmill', 'Flatiron', 'group class', 'beginner', 'HIIT'], price: 3, rating: 4.6, reviews: 540, desc: "NYC's first dedicated run studio with high-energy treadmill classes for runners of all levels." },
  { name: 'The Clay Studio NYC', type: 'class', nb: 'Williamsburg', addr: '61 Greenpoint Ave, Brooklyn, NY 11222', website: 'https://theclaystudionyc.com', phone: '(718) 349-0020', ig: 'theclaystudionyc', tags: ['ceramics', 'pottery', 'Williamsburg', 'wheel throwing', 'hand-building', 'beginner'], price: 2, rating: 4.8, reviews: 290, desc: 'Greenpoint ceramics studio with intro wheel-throwing classes, open studio memberships, and longer-term courses.' },
  { name: 'Eataly Cooking Classes', type: 'class', nb: 'Flatiron', addr: '200 5th Ave, New York, NY 10010', website: 'https://www.eataly.com/us_en/stores/nyc-flatiron/cooking-classes', phone: '(212) 229-2560', ig: 'eataly', tags: ['Italian cooking', 'pasta', 'Flatiron', 'hands-on', 'food market', 'beginners'], price: 3, rating: 4.5, reviews: 670, desc: 'Hands-on Italian cooking classes in the Flatiron Eataly — pasta, risotto, gelato, and more with Italian chefs.' },
  { name: 'Alvin Ailey Extension', type: 'class', nb: 'Midtown', addr: '405 W 55th St, New York, NY 10019', website: 'https://www.alvinailey.org/alvin-ailey-extension', phone: '(212) 405-9000', ig: 'alvinailey', tags: ['dance', 'Ailey', 'Midtown', 'African-American', 'jazz', 'ballet', 'adults'], price: 2, rating: 4.8, reviews: 560, desc: 'Take a class at the legendary Alvin Ailey school — open to adults with Horton technique, jazz, and ballet.' },
  { name: 'Gibney Dance', type: 'class', nb: 'Tribeca', addr: '280 Broadway, New York, NY 10007', website: 'https://gibneydance.org', phone: '(646) 837-6809', ig: 'gibneydance', tags: ['dance', 'contemporary', 'Tribeca', 'community', 'accessible', 'adults'], price: 1, rating: 4.7, reviews: 280, desc: 'Tribeca dance center offering affordable contemporary and community dance classes for adults.' },

  // ── Fitness ──
  { name: 'SLT (Strengthen Lengthen Tone)', type: 'fitness', nb: 'Flatiron', addr: '35 W 14th St, New York, NY 10011', website: 'https://www.slt.co', phone: '(212) 741-0494', ig: 'sltnyc', tags: ['pilates', 'megaformer', 'Flatiron', 'strength', 'toning', 'boutique fitness'], price: 3, rating: 4.7, reviews: 780, desc: 'Megaformer pilates studio focused on slow-twitch muscle fatigue for toning and core strength.' },
  { name: 'Y7 Studio', type: 'fitness', nb: 'Flatiron', addr: '253 W 28th St, New York, NY 10001', website: 'https://www.y7-studio.com', phone: null, ig: 'y7studio', tags: ['yoga', 'hip-hop', 'heated', 'Flatiron', 'candlelit', 'vinyasa'], price: 3, rating: 4.5, reviews: 640, desc: 'Hip-hop yoga studio with candlelit, heated classes and a music-driven flow experience unlike any other.' },
  { name: 'Rumble Boxing', type: 'fitness', nb: 'Chelsea', addr: '175 Varick St, New York, NY 10014', website: 'https://www.rumblefitness.com', phone: null, ig: 'rumblefitness', tags: ['boxing', 'fitness', 'Chelsea', 'group class', 'bags', 'strength'], price: 3, rating: 4.7, reviews: 830, desc: 'High-energy boxing-inspired group fitness classes combining bag work and strength training.' },
  { name: 'The Fhitting Room', type: 'fitness', nb: 'Upper East Side', addr: '110 E 60th St, New York, NY 10022', website: 'https://thefhittingroom.com', phone: '(212) 752-9555', ig: 'thefhittingroom', tags: ['HIIT', 'strength', 'Upper East Side', 'small group', 'functional fitness', 'community'], price: 3, rating: 4.8, reviews: 490, desc: 'Small-group HIIT and strength training studio known for its incredibly effective 50-minute workouts.' },
  { name: 'Pure Barre', type: 'fitness', nb: 'Upper East Side', addr: '305 E 86th St, New York, NY 10028', website: 'https://purebarre.com/ny-upper-east-side', phone: '(212) 479-3313', ig: 'purebarre', tags: ['barre', 'toning', 'Upper East Side', 'low impact', 'women', 'ballet-inspired'], price: 3, rating: 4.5, reviews: 420, desc: 'Ballet-inspired barre workout combining light weights and isometric movements for full-body toning.' },
  { name: 'Tone House', type: 'fitness', nb: 'Flatiron', addr: '37 E 28th St, New York, NY 10016', website: 'https://www.tonehouse.com', phone: '(212) 696-4880', ig: 'tonehouse', tags: ['athletic training', 'Flatiron', 'team sport', 'functional fitness', 'competitive', 'intense'], price: 3, rating: 4.7, reviews: 360, desc: 'Athletic performance training studio inspired by team sports drills — intense, competitive, and community-driven.' },
  { name: 'Chelsea Piers Fitness', type: 'fitness', nb: 'Chelsea', addr: 'Pier 60, Chelsea Piers, New York, NY 10011', website: 'https://www.chelseapiers.com/fitness', phone: '(212) 336-6000', ig: 'chelseapiers', tags: ['fitness center', 'Chelsea', 'pool', 'rock climbing', 'sports', 'waterfront'], price: 3, rating: 4.4, reviews: 1200, desc: "NYC's premier sports and fitness complex on the Hudson River with pools, rock climbing, and group classes." },
  { name: "Barry's", type: 'fitness', nb: 'Flatiron', addr: '27 E 17th St, New York, NY 10003', website: 'https://www.barrys.com/location/new-york', phone: '(212) 691-1500', ig: 'barrys', tags: ['bootcamp', 'treadmill', 'Flatiron', 'HIIT', 'strength', 'red room'], price: 3, rating: 4.7, reviews: 1400, desc: 'The original red-room bootcamp — alternating treadmill cardio and floor strength training in 50 intense minutes.' },
  { name: 'Brooklyn Boulders Williamsburg', type: 'fitness', nb: 'Williamsburg', addr: '575 Degraw St, Brooklyn, NY 11217', website: 'https://brooklynboulders.com/williamsburg', phone: '(347) 834-9066', ig: 'brooklynboulders', tags: ['rock climbing', 'bouldering', 'Williamsburg', 'fitness', 'yoga', 'community'], price: 3, rating: 4.6, reviews: 1100, desc: 'Gowanus climbing gym with bouldering walls, fitness classes, and a vibrant community of all skill levels.' },
  { name: 'BK Yoga Club', type: 'fitness', nb: 'Crown Heights', addr: '1087 Bergen St, Brooklyn, NY 11216', website: 'https://www.bkyogaclub.com', phone: '(718) 635-0404', ig: 'bkyogaclub', tags: ['yoga', 'Crown Heights', 'community', 'accessible', 'affordable', 'vinyasa'], price: 1, rating: 4.8, reviews: 340, desc: 'Crown Heights yoga studio committed to accessible, community-centered practice with sliding scale pricing.' },

  // ── Concert Venues ──
  { name: 'Bowery Ballroom', type: 'concert', nb: 'Lower East Side', addr: '6 Delancey St, New York, NY 10002', website: 'https://www.boweryballroom.com', phone: '(212) 533-2111', ig: 'boweryballroom', tags: ['concert venue', 'indie', 'Lower East Side', 'intimate', 'standing room', 'legendary'], price: 2, rating: 4.8, reviews: 5600, desc: "NYC's most beloved mid-size concert venue — perfect sight lines, great sound, and a storied indie rock history." },
  { name: 'Mercury Lounge', type: 'concert', nb: 'Lower East Side', addr: '217 E Houston St, New York, NY 10002', website: 'https://www.mercuryloungenyc.com', phone: '(212) 260-4700', ig: 'mercuryloungenyc', tags: ['concert venue', 'indie', 'intimate', 'Lower East Side', 'emerging artists', 'live music'], price: 1, rating: 4.7, reviews: 2800, desc: 'Intimate Lower East Side venue where countless famous bands got their start. Raw, loud, and essential.' },
  { name: 'Music Hall of Williamsburg', type: 'concert', nb: 'Williamsburg', addr: '66 N 6th St, Brooklyn, NY 11249', website: 'https://www.musichallofwilliamsburg.com', phone: '(718) 486-5400', ig: 'musichallwilliamsburg', tags: ['concert venue', 'Williamsburg', 'indie', 'Brooklyn', 'mid-size', 'great sound'], price: 2, rating: 4.7, reviews: 4100, desc: "Williamsburg's premier concert hall with excellent acoustics and a lineup of cutting-edge indie and alternative acts." },
  { name: 'Brooklyn Steel', type: 'concert', nb: 'East Williamsburg', addr: '319 Frost St, Brooklyn, NY 11222', website: 'https://www.bowerypresents.com/venue/brooklyn-steel', phone: '(718) 384-5600', ig: 'brooklynsteel', tags: ['concert venue', 'Brooklyn', 'large venue', 'general admission', 'indie', 'standing'], price: 2, rating: 4.6, reviews: 2400, desc: "Brooklyn's best large-capacity standing venue, perfect for mid-size acts in a converted industrial space." },
  { name: 'National Sawdust', type: 'concert', nb: 'Williamsburg', addr: '80 N 6th St, Brooklyn, NY 11249', website: 'https://nationalsawdust.org', phone: '(347) 645-6611', ig: 'nationalsawdust', tags: ['classical', 'experimental', 'Williamsburg', 'new music', 'intimate', 'innovative'], price: 2, rating: 4.9, reviews: 480, desc: 'Stunning Williamsburg venue dedicated to new and experimental music in a repurposed industrial space.' },
  { name: 'Rockwood Music Hall', type: 'concert', nb: 'Lower East Side', addr: '196 Allen St, New York, NY 10002', website: 'https://rockwoodmusichall.com', phone: '(212) 477-4155', ig: 'rockwoodmusichall', tags: ['singer-songwriter', 'intimate', 'Lower East Side', 'acoustic', 'free shows', 'emerging'], price: 1, rating: 4.8, reviews: 3200, desc: 'Three-stage LES venue with nightly live music, free early shows, and an incredible pipeline for emerging artists.' },
  { name: "Baby's All Right", type: 'concert', nb: 'Williamsburg', addr: '146 Broadway, Brooklyn, NY 11249', website: 'https://babysallright.com', phone: '(718) 599-5800', ig: 'babysallright', tags: ['live music', 'bar', 'Williamsburg', 'indie', 'late night', 'food'], price: 2, rating: 4.6, reviews: 1900, desc: 'Williamsburg venue and restaurant with nightly indie rock shows, excellent cocktails, and late-night food.' },
  { name: 'City Winery NYC', type: 'concert', nb: 'Hudson Square', addr: '25 11th Ave, New York, NY 10011', website: 'https://citywinery.com/new-york', phone: '(646) 779-8000', ig: 'citywinery', tags: ['winery', 'live music', 'seated', 'Hudson Square', 'jazz', 'food', 'wine'], price: 3, rating: 4.5, reviews: 2100, desc: 'Winery and music venue with intimate seated shows across multiple stages and a working winery on site.' },
  { name: "Joe's Pub", type: 'concert', nb: 'NoHo', addr: '425 Lafayette St, New York, NY 10003', website: 'https://joespub.publictheater.org', phone: '(212) 539-8778', ig: 'joespub', tags: ['cabaret', 'live music', 'NoHo', 'intimate', 'eclectic', 'dinner show'], price: 2, rating: 4.8, reviews: 3400, desc: "The Public Theater's cabaret venue — diverse nightly programming spanning jazz, pop, world music, and spoken word." },
  { name: 'Brooklyn Bowl', type: 'concert', nb: 'Williamsburg', addr: '61 Wythe Ave, Brooklyn, NY 11249', website: 'https://www.brooklynbowl.com', phone: '(718) 963-3369', ig: 'brooklynbowl', tags: ['bowling', 'live music', 'Williamsburg', 'Blue Ribbon food', 'fun', 'group'], price: 2, rating: 4.5, reviews: 4800, desc: 'Unique Williamsburg venue combining 16 lanes of bowling with live concerts and Blue Ribbon Fried Chicken.' },
  { name: "Arlene's Grocery", type: 'concert', nb: 'Lower East Side', addr: '95 Stanton St, New York, NY 10002', website: 'https://www.arlenesgrocery.net', phone: '(212) 358-1633', ig: 'arlenesgrocery', tags: ['dive bar', 'rock', 'LES', 'intimate', 'punk', 'emerging'], price: 1, rating: 4.5, reviews: 1800, desc: 'Beloved LES dive bar venue where punk rock bands have played since 1995 — raw, sweaty, and essential.' },
  { name: 'Warsaw', type: 'concert', nb: 'Greenpoint', addr: '261 Driggs Ave, Brooklyn, NY 11222', website: 'https://warsawconcerts.com', phone: '(718) 387-5252', ig: 'warsawconcerts', tags: ['concert venue', 'Greenpoint', 'mid-size', 'Brooklyn', 'indie', 'DJ', 'dancing'], price: 2, rating: 4.6, reviews: 2200, desc: 'Massive converted Polish National Home in Greenpoint with a beautiful ballroom hosting mid-size shows and DJ nights.' },
  { name: 'Elsewhere', type: 'concert', nb: 'Bushwick', addr: '599 Johnson Ave, Brooklyn, NY 11237', website: 'https://www.elsewherebrooklyn.com', phone: '(917) 909-1706', ig: 'elsewherebrooklyn', tags: ['electronic', 'DJ', 'Bushwick', 'rooftop', 'nightlife', 'live music', 'art'], price: 2, rating: 4.7, reviews: 2800, desc: "Bushwick's multi-room venue with a rooftop, live music stages, and the best electronic/DJ programming in Brooklyn." },
  { name: 'Village Vanguard', type: 'concert', nb: 'West Village', addr: '178 7th Ave S, New York, NY 10014', website: 'https://villagevanguard.com', phone: '(212) 255-4037', ig: 'villagevanguard', tags: ['jazz', 'historic', 'West Village', 'intimate', 'legendary', 'live music'], price: 2, rating: 4.8, reviews: 3600, desc: "The world's most storied jazz club since 1935 — John Coltrane, Miles Davis, and every great jazz artist performed here." },
  { name: 'The Blue Note', type: 'concert', nb: 'West Village', addr: '131 W 3rd St, New York, NY 10012', website: 'https://bluenotejazz.com/new-york', phone: '(212) 475-8592', ig: 'bluenotejazzclub', tags: ['jazz', 'West Village', 'upscale', 'live music', 'legends', 'dinner show'], price: 3, rating: 4.7, reviews: 4200, desc: 'Iconic West Village jazz club presenting world-class musicians nightly with dinner service and late-night sets.' },
  { name: 'Birdland Jazz Club', type: 'concert', nb: 'Midtown', addr: '315 W 44th St, New York, NY 10036', website: 'https://www.birdlandjazz.com', phone: '(212) 581-3080', ig: 'birdlandjazz', tags: ['jazz', 'Midtown', 'big band', 'dinner show', 'classic', 'live music'], price: 3, rating: 4.7, reviews: 2900, desc: 'Named for Charlie Parker, Birdland hosts world-class jazz nightly in a stylish Midtown setting.' },
  { name: 'Smoke Jazz & Supper Club', type: 'concert', nb: 'Upper West Side', addr: '2751 Broadway, New York, NY 10025', website: 'https://www.smokejazz.com', phone: '(212) 864-6662', ig: 'smokejazz', tags: ['jazz', 'supper club', 'Upper West Side', 'intimate', 'dinner', 'live music'], price: 3, rating: 4.8, reviews: 1100, desc: 'Upper West Side jazz supper club with nightly performances in an intimate room and Southern-inspired food.' },
  { name: 'Le Poisson Rouge', type: 'concert', nb: 'West Village', addr: '158 Bleecker St, New York, NY 10012', website: 'https://lprnyc.com', phone: '(212) 505-3474', ig: 'lepoissonrouge', tags: ['live music', 'West Village', 'eclectic', 'classical', 'electronic', 'indie'], price: 2, rating: 4.6, reviews: 3400, desc: 'West Village multimedia art cabaret with an eclectic mix of classical, electronic, jazz, and indie programming.' },
  { name: 'Carnegie Hall', type: 'concert', nb: 'Midtown', addr: '881 7th Ave, New York, NY 10019', website: 'https://www.carnegiehall.org', phone: '(212) 247-7800', ig: 'carnegiehall', tags: ['classical', 'Midtown', 'world-class', 'prestigious', 'orchestra', 'iconic'], price: 3, rating: 4.9, reviews: 8200, desc: "New York's most celebrated concert hall with a history of legendary performances in three stunning venues." },
  { name: 'BAM (Brooklyn Academy of Music)', type: 'concert', nb: 'Fort Greene', addr: '30 Lafayette Ave, Brooklyn, NY 11217', website: 'https://www.bam.org', phone: '(718) 636-4100', ig: 'bam_brooklyn', tags: ['arts', 'Fort Greene', 'theater', 'opera', 'film', 'contemporary', 'world-class'], price: 2, rating: 4.8, reviews: 5100, desc: "America's oldest performing arts center presenting innovative theater, opera, dance, and film in Fort Greene." },
  { name: 'Our Wicked Lady', type: 'concert', nb: 'Bushwick', addr: '153 Morgan Ave, Brooklyn, NY 11237', website: 'https://www.ourwickedlady.com', phone: '(347) 889-7097', ig: 'ourwickedlady', tags: ['rooftop', 'Bushwick', 'live music', 'bar', 'outdoor', 'punk', 'DJ'], price: 1, rating: 4.6, reviews: 1800, desc: 'Bushwick rooftop bar and venue with nightly live music, great cocktails, and sweeping industrial Brooklyn views.' },
  { name: 'The Sultan Room', type: 'concert', nb: 'Bushwick', addr: '234 Starr St, Brooklyn, NY 11237', website: 'https://thesultanroom.com', phone: '(347) 662-2565', ig: 'thesultanroom', tags: ['live music', 'Bushwick', 'rooftop', 'eclectic', 'DJ', 'bar'], price: 1, rating: 4.6, reviews: 980, desc: 'Bushwick venue with a rooftop bar and intimate performance space featuring diverse music and DJ nights.' },
  { name: 'Public Records', type: 'concert', nb: 'Gowanus', addr: '233 Butler St, Brooklyn, NY 11217', website: 'https://www.publicrecords.nyc', phone: '(718) 360-2897', ig: 'publicrecordsnyc', tags: ['vinyl', 'DJ', 'Gowanus', 'hi-fi sound system', 'electronic', 'record store'], price: 2, rating: 4.8, reviews: 760, desc: 'Gowanus bar and record store with a hi-fi listening room and exceptional DJ and live music programming.' },
  { name: 'Nowadays', type: 'concert', nb: 'Ridgewood', addr: '56-06 Cooper Ave, Queens, NY 11385', website: 'https://nowadays.nyc', phone: null, ig: 'nowadaysnyc', tags: ['outdoor', 'DJ', 'Ridgewood', 'dance music', 'garden', 'weekend', 'electronic'], price: 2, rating: 4.8, reviews: 2100, desc: "Ridgewood's beloved outdoor dance club with legendary Sunday day parties and a beautiful garden space." },

  // ── Shows / Theater / Comedy ──
  { name: 'The Public Theater', type: 'show', nb: 'NoHo', addr: '425 Lafayette St, New York, NY 10003', website: 'https://www.publictheater.org', phone: '(212) 539-8500', ig: 'publictheater', tags: ['theater', 'NoHo', 'Shakespeare', 'new plays', 'Shakespeare in the Park', 'innovative'], price: 2, rating: 4.8, reviews: 3800, desc: "NYC's premier public theater — home to Hamilton's premiere, Free Shakespeare in the Park, and groundbreaking new works." },
  { name: 'Comedy Cellar', type: 'show', nb: 'West Village', addr: '117 MacDougal St, New York, NY 10012', website: 'https://www.comedycellar.com', phone: '(212) 254-3480', ig: 'comedycellar', tags: ['comedy', 'stand-up', 'West Village', 'celebrity drop-ins', 'intimate', 'legendary'], price: 2, rating: 4.8, reviews: 6700, desc: "NYC's most famous comedy club — surprise celebrity drop-ins, legendary alumni, and two shows nightly in a cramped basement." },
  { name: 'Gotham Comedy Club', type: 'show', nb: 'Chelsea', addr: '208 W 23rd St, New York, NY 10011', website: 'https://www.gothamcomedyclub.com', phone: '(212) 367-9000', ig: 'gothamcomedyclub', tags: ['comedy', 'stand-up', 'Chelsea', 'dinner show', 'TV tapings', 'celebrity'], price: 2, rating: 4.6, reviews: 3200, desc: 'Chelsea comedy club and TV taping venue showcasing top comedians from Comedy Central, Netflix, and beyond.' },
  { name: 'UCB Theatre', type: 'show', nb: 'Chelsea', addr: '555 W 42nd St, New York, NY 10036', website: 'https://ucbcomedy.com', phone: '(212) 366-9176', ig: 'ucbcomedy', tags: ['improv', 'sketch comedy', 'Chelsea', 'ASSSSCAT', 'affordable', 'training ground'], price: 1, rating: 4.7, reviews: 2400, desc: "Upright Citizens Brigade — NYC's improv comedy institution launching careers and performing sold-out ASSSSCAT shows." },
  { name: 'Metrograph', type: 'show', nb: 'Lower East Side', addr: '7 Ludlow St, New York, NY 10002', website: 'https://metrograph.com', phone: '(212) 660-0312', ig: 'metrograph', tags: ['cinema', 'arthouse', 'Lower East Side', 'film', 'bar', 'restaurant', 'vintage'], price: 2, rating: 4.8, reviews: 2100, desc: 'Stunning Lower East Side art-house cinema with two screens, a gorgeous bar, and impeccably curated film programming.' },
  { name: 'IFC Center', type: 'show', nb: 'West Village', addr: '323 6th Ave, New York, NY 10014', website: 'https://www.ifccenter.com', phone: '(212) 924-7771', ig: 'ifccenter', tags: ['cinema', 'indie film', 'West Village', 'midnight movies', 'documentary', 'arthouse'], price: 2, rating: 4.7, reviews: 3600, desc: 'West Village indie film institution with midnight cult screenings, documentaries, and the best foreign films.' },
  { name: 'Alamo Drafthouse NYC', type: 'show', nb: 'Downtown Brooklyn', addr: '445 Albee Square W, Brooklyn, NY 11201', website: 'https://drafthouse.com/new-york', phone: '(877) 262-4386', ig: 'drafthousenyc', tags: ['dine-in cinema', 'Downtown Brooklyn', 'cocktails', 'no talking', 'event cinema', 'cult films'], price: 2, rating: 4.8, reviews: 2800, desc: 'Dine-in movie experience with craft cocktails, a strict no-phones policy, and exceptional programming.' },
  { name: 'Anthology Film Archives', type: 'show', nb: 'East Village', addr: '32 2nd Ave, New York, NY 10003', website: 'https://anthologyfilmarchives.org', phone: '(212) 505-5181', ig: 'anthologyfilm', tags: ['avant-garde', 'experimental film', 'East Village', 'archive', 'underground', 'rare'], price: 1, rating: 4.7, reviews: 860, desc: 'East Village archive cinema devoted to experimental and avant-garde film — rare screenings and an essential archive.' },
  { name: 'Drunk Shakespeare', type: 'show', nb: 'Midtown', addr: '77 W 38th St, New York, NY 10018', website: 'https://www.drunkshakespeare.com', phone: '(917) 722-2100', ig: 'drunkshakespeare', tags: ['Shakespeare', 'comedy', 'Midtown', 'unique', 'cocktails', 'interactive'], price: 3, rating: 4.8, reviews: 1400, desc: 'One cast member drinks five whiskeys while performing Shakespeare — raucous, hilarious, and unlike anything else.' },
  { name: 'The Moth', type: 'show', nb: 'Various', addr: 'Various venues across NYC', website: 'https://themoth.org', phone: null, ig: 'themothstories', tags: ['storytelling', 'live stories', 'NYC-wide', 'open mic', 'community', 'radio'], price: 1, rating: 4.8, reviews: 2800, desc: 'Award-winning live storytelling events across NYC — true personal stories told without notes before a live audience.' },
  { name: 'Nuyorican Poets Cafe', type: 'show', nb: 'East Village', addr: '236 E 3rd St, New York, NY 10009', website: 'https://www.nuyorican.org', phone: '(212) 780-9386', ig: 'nuyoricanpoetscafe', tags: ['poetry', 'slam', 'East Village', 'LGBTQ+', 'Latinx', 'live arts', 'community'], price: 1, rating: 4.7, reviews: 940, desc: 'Legendary East Village poetry and arts venue founded in 1973 — home of slam poetry and a vital cultural institution.' },
  { name: 'Playwrights Horizons', type: 'show', nb: "Hell's Kitchen", addr: '416 W 42nd St, New York, NY 10036', website: 'https://www.playwrightshorizons.org', phone: '(212) 564-1235', ig: 'playwrightshorizons', tags: ['theater', 'new works', "Hell's Kitchen", 'off-Broadway', 'emerging playwrights'], price: 2, rating: 4.7, reviews: 980, desc: 'Off-Broadway theater focused exclusively on new American plays and musicals — many Broadway transfers start here.' },
  { name: 'Caveat NYC', type: 'show', nb: 'Lower East Side', addr: '21 A Clinton St, New York, NY 10002', website: 'https://www.caveat.nyc', phone: '(646) 863-8068', ig: 'caveatnyc', tags: ['comedy', 'science', 'trivia', 'LES', 'intellectual', 'weird', 'fun'], price: 1, rating: 4.8, reviews: 740, desc: 'LES venue for intellectually adventurous live shows — science comedy, quiz nights, debates, and weird variety.' },
  { name: 'Sleep No More', type: 'show', nb: 'Chelsea', addr: '530 W 27th St, New York, NY 10001', website: 'https://sleepnomore.com', phone: null, ig: 'sleepnomore', tags: ['immersive theater', 'Chelsea', 'Punchdrunk', 'Shakespeare', 'unique', 'mystery'], price: 3, rating: 4.7, reviews: 3200, desc: "Punchdrunk's landmark immersive theater experience — wander masked through six floors of cinematic space." },
  { name: 'Angelika Film Center', type: 'show', nb: 'SoHo', addr: '18 W Houston St, New York, NY 10012', website: 'https://angelikafilmcenter.com/nyc', phone: '(212) 995-2000', ig: 'angelikafilmcenter', tags: ['cinema', 'indie', 'SoHo', 'art house', 'coffee', 'documentary'], price: 2, rating: 4.4, reviews: 3100, desc: "SoHo's legendary indie film hub with six screens, a cafe, and NYC premieres of the best independent films." },
  { name: 'Museum of the Moving Image', type: 'show', nb: 'Astoria', addr: '36-01 35th Ave, Astoria, NY 11106', website: 'https://movingimage.us', phone: '(718) 777-6888', ig: 'movingimage', tags: ['film', 'museum', 'Astoria', 'Queens', 'interactive', 'cinema history', 'screening'], price: 2, rating: 4.8, reviews: 2400, desc: 'Astoria museum dedicated to the art and history of film, TV, and digital media with screenings and exhibitions.' },

  // ── Parties / Nightlife ──
  { name: 'Avant Gardner / Brooklyn Mirage', type: 'party', nb: 'East Williamsburg', addr: '140 Stewart Ave, Brooklyn, NY 11237', website: 'https://avantgardner.com', phone: null, ig: 'avantgardnernyc', tags: ['nightclub', 'outdoor', 'East Williamsburg', 'electronic music', 'massive', 'summer'], price: 3, rating: 4.8, reviews: 6200, desc: "NYC's premier outdoor electronic music complex with multiple stages including the legendary Brooklyn Mirage." },
  { name: 'Bossa Nova Civic Club', type: 'party', nb: 'Bushwick', addr: '1271 Myrtle Ave, Brooklyn, NY 11221', website: 'https://www.bossanovacivicclub.com', phone: null, ig: 'bossanovacivicclub', tags: ['disco', 'techno', 'Bushwick', 'dance', 'late night', 'dark', 'club'], price: 1, rating: 4.7, reviews: 1600, desc: "Bushwick's best dance club — sweaty, dark, and playing the best techno, disco, and house in Brooklyn." },
  { name: 'Westlight', type: 'party', nb: 'Williamsburg', addr: '111 N 12th St, Brooklyn, NY 11249', website: 'https://www.wythehotel.com/westlight', phone: '(718) 490-7019', ig: 'westlightnyc', tags: ['rooftop bar', 'Williamsburg', 'views', 'cocktails', 'upscale', 'skyline'], price: 3, rating: 4.6, reviews: 2600, desc: "Wythe Hotel's rooftop bar with jaw-dropping Manhattan skyline views and craft cocktails above Williamsburg." },
  { name: '230 Fifth Rooftop Bar', type: 'party', nb: 'Flatiron', addr: '230 5th Ave, New York, NY 10001', website: 'https://230-fifth.com', phone: '(212) 725-4300', ig: '230fifth', tags: ['rooftop bar', 'Flatiron', 'Empire State Building views', 'outdoor', 'cocktails', 'fun'], price: 2, rating: 4.3, reviews: 7800, desc: "NYC's largest rooftop bar with stunning Empire State Building views, heated igloos, and a party atmosphere." },
  { name: 'Le Bain at The Standard', type: 'party', nb: 'Meatpacking', addr: '848 Washington St, New York, NY 10014', website: 'https://www.standardhotels.com/new-york/features/le-bain', phone: '(212) 645-4646', ig: 'standardhotels', tags: ['rooftop', 'Meatpacking', 'DJ', 'dancing', 'views', 'upscale', 'summer'], price: 3, rating: 4.5, reviews: 3200, desc: "The Standard's iconic rooftop club with a hot tub, epic Hudson River views, and world-class DJs." },
  { name: 'Cielo', type: 'party', nb: 'Meatpacking', addr: '18 Little W 12th St, New York, NY 10014', website: 'https://www.cieloclub.com', phone: '(212) 645-5700', ig: 'cielony', tags: ['nightclub', 'dance', 'Meatpacking', 'house music', 'techno', 'hi-fi'], price: 3, rating: 4.6, reviews: 2100, desc: "Meatpacking's best club with world-class DJs, a legendary sound system, and intimate dance floor." },
  { name: 'Good Room', type: 'party', nb: 'Greenpoint', addr: '98 Meserole Ave, Brooklyn, NY 11222', website: 'https://www.goodroombk.com', phone: '(718) 349-2373', ig: 'goodroombk', tags: ['club', 'Greenpoint', 'techno', 'disco', 'late night', 'dance', 'Brooklyn'], price: 2, rating: 4.7, reviews: 1800, desc: "Greenpoint's favorite late-night club with two rooms, excellent sound, and the best disco and techno in Brooklyn." },
  { name: 'Mr. Purple', type: 'party', nb: 'Lower East Side', addr: '180 Orchard St, New York, NY 10002', website: 'https://www.mrpurplenyc.com', phone: '(212) 237-1790', ig: 'mrpurplenyc', tags: ['rooftop bar', 'Lower East Side', 'pool', 'views', 'cocktails', 'upscale'], price: 3, rating: 4.4, reviews: 2400, desc: 'LES rooftop bar with a small pool, city views, and craft cocktails high above Orchard Street.' },
  { name: 'The Roxy Hotel Bar', type: 'party', nb: 'Tribeca', addr: '2 6th Ave, New York, NY 10013', website: 'https://www.roxyhotelnyc.com', phone: '(212) 519-6600', ig: 'roxyhotelnyc', tags: ['hotel bar', 'Tribeca', 'jazz', 'late night', 'cocktails', 'DJ', 'cool crowd'], price: 3, rating: 4.5, reviews: 1200, desc: 'Tribeca hotel with a legendary lobby bar, nightly jazz and DJ sets, and an intimate cinema.' },
  { name: 'Sunnyvale', type: 'party', nb: 'Bushwick', addr: '1031 Grand St, Brooklyn, NY 11211', website: 'https://www.sunnyvalebar.com', phone: '(718) 218-7855', ig: 'sunnyvalebar', tags: ['bar', 'Bushwick', 'DJ', 'dancing', 'outdoor', 'patio', 'late night'], price: 1, rating: 4.6, reviews: 1200, desc: 'Bushwick dive bar and club with a sprawling outdoor patio, late-night DJs, and an extremely chill vibe.' },

  // ── Exhibits / Galleries / Museums ──
  { name: 'The Metropolitan Museum of Art', type: 'exhibit', nb: 'Upper East Side', addr: '1000 5th Ave, New York, NY 10028', website: 'https://www.metmuseum.org', phone: '(212) 535-7710', ig: 'metmuseum', tags: ['art', 'museum', 'Upper East Side', 'world-class', 'Egyptian art', 'European art', 'free for members'], price: 2, rating: 4.9, reviews: 42000, desc: "One of the world's greatest museums with 5,000 years of art across 17 curatorial departments." },
  { name: 'MoMA', type: 'exhibit', nb: 'Midtown', addr: '11 W 53rd St, New York, NY 10019', website: 'https://www.moma.org', phone: '(212) 708-9400', ig: 'themuseumofmodernart', tags: ['modern art', 'Midtown', 'Picasso', 'Warhol', 'film', 'design', 'world-class'], price: 2, rating: 4.8, reviews: 28000, desc: 'Museum of Modern Art housing masterworks by Picasso, van Gogh, Warhol, and a stunning contemporary collection.' },
  { name: 'Whitney Museum of American Art', type: 'exhibit', nb: 'Meatpacking', addr: '99 Gansevoort St, New York, NY 10014', website: 'https://whitney.org', phone: '(212) 570-3600', ig: 'whitneymuseum', tags: ['American art', 'Meatpacking', 'contemporary', 'rooftop', 'Biennial', 'views'], price: 2, rating: 4.7, reviews: 9800, desc: 'Renzo Piano-designed museum on the High Line dedicated to 20th and 21st century American art with rooftop views.' },
  { name: 'Guggenheim Museum', type: 'exhibit', nb: 'Upper East Side', addr: '1071 5th Ave, New York, NY 10128', website: 'https://www.guggenheim.org', phone: '(212) 423-3500', ig: 'guggenheim', tags: ['modern art', 'Upper East Side', 'Frank Lloyd Wright', 'architecture', 'iconic', 'world-class'], price: 2, rating: 4.7, reviews: 18000, desc: "Frank Lloyd Wright's spiraling architectural masterpiece housing an unparalleled collection of modern and contemporary art." },
  { name: 'New Museum', type: 'exhibit', nb: 'Lower East Side', addr: '235 Bowery, New York, NY 10002', website: 'https://www.newmuseum.org', phone: '(212) 219-1222', ig: 'newmuseum', tags: ['contemporary art', 'Lower East Side', 'cutting edge', 'new media', 'emerging artists'], price: 2, rating: 4.7, reviews: 4200, desc: 'The only museum in NYC dedicated exclusively to new art and new ideas — consistently the most adventurous programming.' },
  { name: 'Fotografiska New York', type: 'exhibit', nb: 'Flatiron', addr: '281 Park Ave S, New York, NY 10010', website: 'https://fotografiska.com/nyc', phone: '(212) 433-3686', ig: 'fotografiskany', tags: ['photography', 'Flatiron', 'contemporary', 'restaurant', 'bar', 'evening events'], price: 2, rating: 4.7, reviews: 2800, desc: 'Stunning Flatiron photography museum with world-class exhibitions, a rooftop bar, and vibrant evening programming.' },
  { name: 'The Shed', type: 'exhibit', nb: 'Hudson Yards', addr: '545 W 30th St, New York, NY 10001', website: 'https://theshed.org', phone: '(646) 455-3494', ig: 'theshedny', tags: ['arts center', 'Hudson Yards', 'innovative', 'multidisciplinary', 'performance', 'visual art'], price: 2, rating: 4.7, reviews: 2100, desc: "NYC's newest cultural institution with a moveable shell housing ambitious multidisciplinary commissions." },
  { name: 'ICP (International Center of Photography)', type: 'exhibit', nb: 'Lower East Side', addr: '79 Essex St, New York, NY 10002', website: 'https://www.icp.org', phone: '(212) 857-0000', ig: 'icpnyc', tags: ['photography', 'Lower East Side', 'documentary', 'exhibitions', 'education', 'social issues'], price: 2, rating: 4.7, reviews: 1400, desc: 'World-renowned photography institution in the Essex Market with socially engaged exhibitions and education programs.' },
  { name: 'The Noguchi Museum', type: 'exhibit', nb: 'Long Island City', addr: '9-01 33rd Rd, Queens, NY 11106', website: 'https://www.noguchi.org', phone: '(718) 204-7088', ig: 'noguchimuseum', tags: ['sculpture', 'Long Island City', 'Japanese-American', 'garden', 'peaceful', 'Queens'], price: 2, rating: 4.8, reviews: 2400, desc: "Isamu Noguchi's stunning sculpture museum in Long Island City with indoor galleries and a serene stone garden." },
  { name: 'Socrates Sculpture Park', type: 'exhibit', nb: 'Long Island City', addr: '32-01 Vernon Blvd, Queens, NY 11106', website: 'https://socratessculpturepark.org', phone: '(718) 956-1819', ig: 'socratessculpturepark', tags: ['sculpture', 'outdoor', 'Long Island City', 'free', 'waterfront', 'Queens', 'public art'], price: 1, rating: 4.8, reviews: 1800, desc: 'Free outdoor sculpture park on the Queens waterfront with rotating large-scale works and stunning Manhattan views.' },
  { name: 'The Frick Collection', type: 'exhibit', nb: 'Upper East Side', addr: '1 E 70th St, New York, NY 10021', website: 'https://www.frick.org', phone: '(212) 288-0700', ig: 'thefrick', tags: ['Old Masters', 'Upper East Side', 'mansion', 'Vermeer', 'Rembrandt', 'intimate'], price: 2, rating: 4.9, reviews: 6200, desc: "Henry Clay Frick's mansion turned museum housing Old Masters in intimate settings — one of NYC's most beloved." },
  { name: 'Cooper Hewitt, Smithsonian Design Museum', type: 'exhibit', nb: 'Upper East Side', addr: '2 E 91st St, New York, NY 10128', website: 'https://www.cooperhewitt.org', phone: '(212) 849-8400', ig: 'cooperhewitt', tags: ['design', 'Upper East Side', 'interactive', 'Smithsonian', 'pen', 'Carnegie mansion'], price: 2, rating: 4.7, reviews: 3800, desc: 'Smithsonian design museum in a Carnegie mansion with interactive digital pen — visitors can draw and curate exhibits.' },
  { name: 'David Zwirner Gallery', type: 'exhibit', nb: 'Chelsea', addr: '519-533 W 19th St, New York, NY 10011', website: 'https://www.davidzwirner.com', phone: '(212) 517-8677', ig: 'davidzwirner', tags: ['contemporary art', 'Chelsea', 'gallery', 'free', 'world-class', 'major artists'], price: 1, rating: 4.7, reviews: 940, desc: "One of NYC's most influential contemporary art galleries spanning three Chelsea buildings with free admission." },
  { name: 'Gagosian Gallery', type: 'exhibit', nb: 'Chelsea', addr: '555 W 24th St, New York, NY 10011', website: 'https://gagosian.com', phone: '(212) 741-1111', ig: 'gagosian', tags: ['contemporary art', 'Chelsea', 'gallery', 'free', 'blue-chip', 'major artists'], price: 1, rating: 4.7, reviews: 1200, desc: "Larry Gagosian's flagship gallery showing the most celebrated contemporary artists — always a must-see exhibition." },
  { name: 'Wave Hill', type: 'exhibit', nb: 'Bronx', addr: '4900 Independence Ave, Bronx, NY 10471', website: 'https://www.wavehill.org', phone: '(718) 549-3200', ig: 'wave_hill', tags: ['garden', 'Bronx', 'nature', 'views', 'Hudson River', 'peaceful', 'art'], price: 2, rating: 4.8, reviews: 2800, desc: 'Public garden and cultural center in the Bronx overlooking the Hudson River and Palisades — breathtakingly beautiful.' },
  { name: 'El Museo del Barrio', type: 'exhibit', nb: 'Upper East Side', addr: '1230 5th Ave, New York, NY 10029', website: 'https://www.elmuseo.org', phone: '(212) 831-7272', ig: 'elmuseodelbarrio', tags: ['Latino art', 'Caribbean art', 'Upper East Side', 'Museum Mile', 'cultural', 'community'], price: 2, rating: 4.7, reviews: 1400, desc: "Museum Mile's premier Latinx and Caribbean art institution — vibrant, community-rooted, and essential." },
  { name: 'Rubin Museum of Art', type: 'exhibit', nb: 'Chelsea', addr: '150 W 17th St, New York, NY 10011', website: 'https://rubinmuseum.org', phone: '(212) 620-5000', ig: 'rubinmuseum', tags: ['Himalayan art', 'Chelsea', 'meditation', 'Buddhism', 'unique', 'world art'], price: 2, rating: 4.7, reviews: 1800, desc: 'Chelsea museum dedicated to Himalayan and Indian art with meditation sessions and fascinating rotating exhibitions.' },

  // ── Markets ──
  { name: 'Brooklyn Flea', type: 'market', nb: 'Williamsburg', addr: '50 Kent Ave, Brooklyn, NY 11249', website: 'https://brooklynflea.com', phone: null, ig: 'brooklynflea', tags: ['flea market', 'vintage', 'Williamsburg', 'antiques', 'local designers', 'weekend'], price: 1, rating: 4.6, reviews: 8900, desc: "NYC's best weekend flea market with 150+ vendors selling vintage clothing, antiques, and unique local goods." },
  { name: 'Grand Army Plaza Greenmarket', type: 'market', nb: 'Prospect Heights', addr: 'Grand Army Plaza, Brooklyn, NY 11238', website: 'https://www.grownyc.org/greenmarket/brooklyn-grand-army-plaza', phone: null, ig: 'grownyc', tags: ['farmers market', 'Prospect Heights', 'organic', 'Saturday', 'seasonal', 'local farms'], price: 1, rating: 4.8, reviews: 4200, desc: "Brooklyn's premier Saturday farmers market at the base of Prospect Park with 45+ regional farms and producers." },
  { name: 'Union Square Greenmarket', type: 'market', nb: 'Flatiron', addr: 'Union Square W, New York, NY 10003', website: 'https://www.grownyc.org/greenmarket/manhattan-union-square-m', phone: null, ig: 'grownyc', tags: ['farmers market', 'Union Square', 'year-round', 'Monday Wednesday Friday Saturday', 'organic'], price: 1, rating: 4.8, reviews: 12000, desc: "NYC's most famous greenmarket running four days a week with 140+ regional farms — a city institution since 1976." },
  { name: "Hell's Kitchen Flea Market", type: 'market', nb: "Hell's Kitchen", addr: '39 W 25th St, New York, NY 10010', website: 'https://hellskitchenfleamarket.com', phone: '(212) 243-5343', ig: 'hkflea', tags: ['flea market', 'antiques', "Hell's Kitchen", 'vintage', 'weekend', 'indoor outdoor'], price: 1, rating: 4.4, reviews: 3200, desc: 'Weekend flea market with 170+ vendors of vintage clothing, furniture, art, and jewelry in the heart of Manhattan.' },
  { name: 'Hester Street Fair', type: 'market', nb: 'Lower East Side', addr: 'Corner of Essex & Hester St, New York, NY 10002', website: 'https://hesterstreetfair.com', phone: null, ig: 'hesterstreetfair', tags: ['street fair', 'Lower East Side', 'local makers', 'food', 'seasonal', 'artisan'], price: 1, rating: 4.6, reviews: 2100, desc: 'Beloved Lower East Side street market on Saturday featuring local artisan food vendors and independent designers.' },
  { name: 'Essex Market', type: 'market', nb: 'Lower East Side', addr: '88 Essex St, New York, NY 10002', website: 'https://essexmarket.nyc', phone: null, ig: 'essexmarket', tags: ['food market', 'Lower East Side', 'vendors', 'diverse', 'year-round', 'indoor'], price: 1, rating: 4.5, reviews: 1600, desc: 'Revived LES market hall with 40+ vendors spanning traditional Jewish deli, Caribbean, Asian, and artisanal foods.' },
  { name: 'Chelsea Market', type: 'market', nb: 'Chelsea', addr: '75 9th Ave, New York, NY 10011', website: 'https://chelseamarket.com', phone: null, ig: 'chelseamarket', tags: ['food hall', 'Chelsea', 'year-round', 'gourmet', 'shopping', 'High Line'], price: 2, rating: 4.5, reviews: 22000, desc: "NYC's iconic indoor market in a converted Nabisco factory with gourmet food vendors, shops, and restaurants." },
  { name: 'DeKalb Market Hall', type: 'market', nb: 'Downtown Brooklyn', addr: '445 Albee Square W, Brooklyn, NY 11201', website: 'https://www.dekalbmarkethall.com', phone: null, ig: 'dekalbmarkethall', tags: ['food hall', 'Downtown Brooklyn', 'diverse', 'year-round', 'lunch', 'dinner'], price: 1, rating: 4.4, reviews: 3400, desc: 'Downtown Brooklyn food hall with 40+ vendors spanning international cuisines — great for a quick diverse meal.' },
  { name: 'Queens Night Market', type: 'market', nb: 'Jackson Heights', addr: 'New York Hall of Science, 47-01 111th St, Queens, NY 11368', website: 'https://queensnightmarket.com', phone: null, ig: 'queensnightmarket', tags: ['night market', 'Queens', 'diverse food', 'outdoor', 'weekend', 'affordable'], price: 1, rating: 4.8, reviews: 4600, desc: "Beloved Queens night market celebrating diversity with 100+ global food vendors from the world's most diverse borough." },
  { name: 'Urbanspace Vanderbilt', type: 'market', nb: 'Midtown', addr: '230 Park Ave, New York, NY 10169', website: 'https://urbanspacenyc.com/urbanspace-vanderbilt', phone: null, ig: 'urbanspacenyc', tags: ['food market', 'Midtown', 'lunch', 'dinner', 'Grand Central', 'year-round'], price: 2, rating: 4.5, reviews: 2800, desc: 'Midtown food hall near Grand Central with a curated mix of local NYC restaurant vendors.' },
  { name: 'Industry City', type: 'market', nb: 'Sunset Park', addr: '220 36th St, Brooklyn, NY 11232', website: 'https://industrycity.com', phone: '(718) 965-6400', ig: 'industrycitybrooklyn', tags: ['food', 'shopping', 'Sunset Park', 'makers', 'market', 'outdoor', 'creative'], price: 2, rating: 4.6, reviews: 5200, desc: 'Massive Sunset Park creative campus with specialty food vendors, artisan makers, shops, and waterfront views.' },
  { name: 'Smorgasburg Prospect Park', type: 'market', nb: 'Park Slope', addr: 'Breeze Hill, Prospect Park, Brooklyn, NY 11215', website: 'https://www.smorgasburg.com', phone: null, ig: 'smorgasburg', tags: ['food market', 'Park Slope', 'outdoor', 'Saturday', 'vendors', 'Brooklyn', 'diverse food'], price: 2, rating: 4.5, reviews: 5400, desc: "NYC's premier open-air food market every Saturday in Prospect Park with 100+ local food vendors." },
  { name: 'Astoria Flea & Food', type: 'market', nb: 'Astoria', addr: '14-44 31st Ave, Astoria, NY 11106', website: 'https://astoriaflea.com', phone: null, ig: 'astoriaflea', tags: ['flea market', 'Astoria', 'Queens', 'food', 'vintage', 'local', 'weekend'], price: 1, rating: 4.6, reviews: 1400, desc: 'Queens flea market with vintage finds, local food vendors, and a festive outdoor atmosphere in Astoria.' },
]

// ─── Image sources (using Unsplash free images by category) ──────────────────

const PLACEHOLDER_IMAGES: Record<string, string[]> = {
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800',
    'https://images.unsplash.com/photo-1579684947550-22e945225d9a?w=800',
  ],
  class: [
    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800',
    'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
  ],
  concert: [
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    'https://images.unsplash.com/photo-1540039155733-5bb30b4f5f8a?w=800',
  ],
  show: [
    'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
    'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800',
  ],
  party: [
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
  ],
  exhibit: [
    'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800',
    'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800',
  ],
  market: [
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800',
    'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=800',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
  ],
  other: [
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800',
  ],
}

function getImages(type: string): string[] {
  return PLACEHOLDER_IMAGES[type] ?? PLACEHOLDER_IMAGES.other
}

// ─── Main seed function ───────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting seed...')

  // Clear existing data
  await prisma.userInteraction.deleteMany()
  await prisma.savedItem.deleteMany()
  await prisma.claimRequest.deleteMany()
  await prisma.post.deleteMany()
  await prisma.media.deleteMany()
  await prisma.reviewSummary.deleteMany()
  await prisma.occurrence.deleteMany()
  await prisma.sourceRecord.deleteMany()
  await prisma.userPreferences.deleteMany()
  await prisma.user.deleteMany()
  await prisma.entity.deleteMany()

  console.log('🗑️  Cleared old data')

  const entityIds: string[] = []

  // ─── Seed restaurants ─────────────────────────────────────────────────────

  console.log('🍽️  Seeding restaurants...')
  for (const r of RESTAURANT_DATA) {
    const nb = r.nb
    const borough = BOROUGH_MAP[nb] ?? 'Brooklyn'
    const tags = r.tags

    const completeness = computeCompleteness({
      address: r.addr,
      neighborhood: nb,
      website: r.website ?? null,
      phone: r.phone ?? null,
      business_hours: JSON.stringify(pick(HOURS_TEMPLATES)),
      media_count: 2,
      has_description: true,
    })

    const entity = await prisma.entity.create({
      data: {
        entity_type: 'restaurant',
        canonical_name: r.name,
        short_description: r.desc.slice(0, 140),
        full_description: r.desc,
        tags: JSON.stringify(tags),
        category_confidence: 0.97,
        neighborhood: nb,
        borough,
        address: r.addr,
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.0060 + (Math.random() - 0.5) * 0.1,
        website: r.website ?? null,
        phone: r.phone ?? null,
        instagram_handle: r.ig ?? null,
        business_hours: JSON.stringify(pick(HOURS_TEMPLATES)),
        price_level: r.price,
        source_urls: JSON.stringify([r.source ?? r.website ?? ''].filter(Boolean)),
        source_confidence: 0.85,
        metadata_completeness: completeness,
        has_good_media: true,
      },
    })

    // Media
    const imgs = getImages('restaurant')
    await prisma.media.create({
      data: {
        entity_id: entity.id,
        media_type: 'image',
        source_platform: 'direct',
        source_url: pick(imgs),
        thumbnail_url: pick(imgs),
        alt_text: entity.canonical_name,
        rights_status: 'linked',
        ranking_score: 0.9,
        is_primary: true,
      },
    })

    // Reviews
    const quotes = [
      `One of the best ${tags[0] ?? 'dining'} experiences in NYC.`,
      `The ${tags[0] ?? 'food'} here is absolutely phenomenal — worth every penny.`,
      `A true NYC institution. Never disappoints.`,
    ]
    await prisma.reviewSummary.create({
      data: {
        entity_id: entity.id,
        review_summary: r.desc.slice(0, 120),
        sentiment_score: (r.rating - 2.5) / 2.5,
        review_count: r.reviews,
        avg_rating: r.rating,
        notable_quotes: JSON.stringify(pickN(quotes, 2)),
        source_breakdown: JSON.stringify({ google: Math.floor(r.reviews * 0.6), yelp: Math.floor(r.reviews * 0.4) }),
      },
    })

    entityIds.push(entity.id)
  }

  // ─── Seed classes ──────────────────────────────────────────────────────────

  console.log('🎨 Seeding classes...')
  for (const c of CLASS_DATA) {
    const nb = c.nb
    const borough = BOROUGH_MAP[nb] ?? 'Brooklyn'

    const entity = await prisma.entity.create({
      data: {
        entity_type: 'class',
        canonical_name: c.name,
        short_description: c.desc.slice(0, 140),
        full_description: c.desc,
        tags: JSON.stringify(c.tags),
        category_confidence: 0.95,
        neighborhood: nb,
        borough,
        address: c.addr,
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.0060 + (Math.random() - 0.5) * 0.1,
        website: c.website ?? null,
        phone: c.phone ?? null,
        instagram_handle: c.ig ?? null,
        business_hours: JSON.stringify(pick(HOURS_TEMPLATES)),
        price_level: c.price,
        source_urls: JSON.stringify([c.website ?? ''].filter(Boolean)),
        source_confidence: 0.80,
        metadata_completeness: 0.85,
        has_good_media: true,
      },
    })

    await prisma.media.create({
      data: {
        entity_id: entity.id,
        media_type: 'image',
        source_platform: 'direct',
        source_url: pick(getImages('class')),
        thumbnail_url: pick(getImages('class')),
        alt_text: entity.canonical_name,
        rights_status: 'linked',
        ranking_score: 0.85,
        is_primary: true,
      },
    })

    // Upcoming class sessions
    for (let s = 0; s < 3; s++) {
      const start = future(1, 60)
      await prisma.occurrence.create({
        data: {
          entity_id: entity.id,
          title: `${entity.canonical_name} — ${pick(['Beginner', 'Intermediate', 'All Levels'])} Workshop`,
          start_time: start,
          end_time: futurePlus(start, rand(2, 4)),
          ticket_url: c.website ?? null,
          price: `$${rand(35, 150)}`,
          price_cents_min: 3500,
          price_cents_max: 15000,
          capacity: rand(6, 20),
          event_status: 'scheduled',
          freshness_score: 1.0,
        },
      })
    }

    await prisma.reviewSummary.create({
      data: {
        entity_id: entity.id,
        review_summary: c.desc.slice(0, 120),
        sentiment_score: (c.rating - 2.5) / 2.5,
        review_count: c.reviews,
        avg_rating: c.rating,
        notable_quotes: JSON.stringify([`Amazing instructor, I learned so much!`, `Highly recommend for beginners.`]),
        source_breakdown: JSON.stringify({ google: Math.floor(c.reviews * 0.7), yelp: Math.floor(c.reviews * 0.3) }),
      },
    })

    entityIds.push(entity.id)
  }

  // ─── Seed events/shows/concerts ───────────────────────────────────────────

  console.log('🎭 Seeding events...')
  for (const ev of EVENT_DATA) {
    const nb = ev.nb
    const borough = BOROUGH_MAP[nb] ?? 'Brooklyn'

    const entity = await prisma.entity.create({
      data: {
        entity_type: ev.type,
        canonical_name: ev.name,
        short_description: ev.desc.slice(0, 140),
        full_description: ev.desc,
        tags: JSON.stringify(ev.tags),
        category_confidence: 0.92,
        neighborhood: nb,
        borough,
        address: ev.addr,
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.0060 + (Math.random() - 0.5) * 0.1,
        website: ev.website ?? null,
        phone: ev.phone ?? null,
        instagram_handle: ev.ig ?? null,
        price_level: ev.price,
        source_urls: JSON.stringify([ev.website ?? ''].filter(Boolean)),
        source_confidence: 0.82,
        metadata_completeness: 0.80,
        has_good_media: true,
      },
    })

    await prisma.media.create({
      data: {
        entity_id: entity.id,
        media_type: 'image',
        source_platform: 'direct',
        source_url: pick(getImages(ev.type)),
        thumbnail_url: pick(getImages(ev.type)),
        alt_text: entity.canonical_name,
        rights_status: 'linked',
        ranking_score: 0.88,
        is_primary: true,
      },
    })

    // Event occurrences
    for (let o = 0; o < rand(1, 4); o++) {
      const start = future(1, 45)
      const eventTitles = [
        entity.canonical_name,
        `${entity.canonical_name} — Special Edition`,
        `${entity.canonical_name} Opening Night`,
        `${entity.canonical_name} Late Show`,
      ]
      await prisma.occurrence.create({
        data: {
          entity_id: entity.id,
          title: pick(eventTitles),
          start_time: start,
          end_time: futurePlus(start, rand(2, 5)),
          ticket_url: ev.website ?? null,
          price: ev.price === 1 ? 'Free–$10' : ev.price === 2 ? '$15–$30' : ev.price === 3 ? '$25–$65' : '$50–$150',
          event_status: 'scheduled',
          freshness_score: 1.0,
        },
      })
    }

    await prisma.reviewSummary.create({
      data: {
        entity_id: entity.id,
        review_summary: ev.desc.slice(0, 120),
        sentiment_score: (ev.rating - 2.5) / 2.5,
        review_count: ev.reviews,
        avg_rating: ev.rating,
        notable_quotes: JSON.stringify([`Best night out in NYC this year.`, `Don't miss this one.`]),
        source_breakdown: JSON.stringify({ eventbrite: Math.floor(ev.reviews * 0.5), google: Math.floor(ev.reviews * 0.5) }),
      },
    })

    entityIds.push(entity.id)
  }

  console.log(`✅ Core entities seeded: ${entityIds.length}`)

  // ─── Seed additional real entities ────────────────────────────────────────

  const additional = ADDITIONAL_ENTITY_DATA
  console.log(`🏙️  Seeding ${additional.length} additional real entities...`)

  for (const a of additional) {
    const type = a.type
    const borough = BOROUGH_MAP[a.nb] ?? 'Brooklyn'
    const entity = await prisma.entity.create({
      data: {
        entity_type: type,
        canonical_name: a.name,
        short_description: a.desc.slice(0, 140),
        full_description: a.desc,
        tags: JSON.stringify(a.tags),
        category_confidence: 0.92,
        neighborhood: a.nb,
        borough,
        address: a.addr,
        lat: 40.7128 + (Math.random() - 0.5) * 0.15,
        lng: -74.0060 + (Math.random() - 0.5) * 0.15,
        website: a.website ?? null,
        phone: a.phone,
        instagram_handle: a.ig,
        business_hours: JSON.stringify(pick(HOURS_TEMPLATES)),
        price_level: a.price,
        source_urls: JSON.stringify([a.website ?? ''].filter(Boolean)),
        source_confidence: 0.85,
        metadata_completeness: 0.88,
        has_good_media: true,
      },
    })

    // Placeholder image — will be replaced by fetch-og-images.ts
    const imgUrl = pick(getImages(type))
    await prisma.media.create({
      data: {
        entity_id: entity.id,
        media_type: 'image',
        source_platform: 'direct',
        source_url: imgUrl,
        thumbnail_url: imgUrl,
        alt_text: a.name,
        rights_status: 'linked',
        ranking_score: 0.88,
        is_primary: true,
      },
    })

    if (['class', 'show', 'concert', 'party', 'exhibit', 'market'].includes(type)) {
      const start = future(1, 90)
      await prisma.occurrence.create({
        data: {
          entity_id: entity.id,
          title: entity.canonical_name,
          start_time: start,
          end_time: futurePlus(start, rand(2, 5)),
          ticket_url: a.website ?? null,
          price: ['Free', '$10', '$15–$25', '$30–$60'][rand(0, 3)],
          event_status: 'scheduled',
          freshness_score: 0.9,
        },
      })
    }

    await prisma.reviewSummary.create({
      data: {
        entity_id: entity.id,
        review_summary: a.desc.slice(0, 100),
        sentiment_score: (a.rating - 2.5) / 2.5,
        review_count: a.reviews,
        avg_rating: a.rating,
        notable_quotes: JSON.stringify([`An excellent choice in ${a.nb}.`]),
        source_breakdown: JSON.stringify({ google: Math.floor(a.reviews * 0.6), yelp: Math.floor(a.reviews * 0.4) }),
      },
    })

    entityIds.push(entity.id)
  }

  const totalEntities = await prisma.entity.count()
  console.log(`✅ Total entities: ${totalEntities}`)

  // ─── Create 100 feed-ready posts ──────────────────────────────────────────

  console.log('📰 Creating 100 feed posts...')

  // Select top 100 entity IDs to make posts from
  const topEntities = await prisma.entity.findMany({
    orderBy: [{ metadata_completeness: 'desc' }, { source_confidence: 'desc' }],
    take: 100,
    include: { media: true, reviews: true, occurrences: { take: 1 } },
  })

  const postHeadlines: Record<string, (name: string, tags: string[], nb: string) => string> = {
    restaurant: (name, tags, nb) => `Eat at ${name} in ${nb}`,
    class: (name, tags, nb) => `Learn ${tags[0] ?? 'something new'} at ${name}`,
    show: (name, _tags, nb) => `Don't miss ${name} in ${nb}`,
    concert: (name, tags, nb) => `${tags.includes('jazz') ? 'Jazz' : 'Live'} music at ${name}`,
    party: (name, _tags, nb) => `Party at ${name} this weekend`,
    exhibit: (name, _tags, nb) => `Explore ${name} in ${nb}`,
    market: (name, _tags, nb) => `Shop ${name} in ${nb}`,
    fitness: (name, tags, nb) => `Try ${tags[0] ?? 'fitness'} at ${name}`,
    other: (name, _tags, nb) => `Discover ${name} in ${nb}`,
  }

  const postSubheadlines: Record<string, (desc: string, nb: string, price: string) => string> = {
    restaurant: (desc, nb, price) => `${nb} · ${price || '$'}`,
    class: (desc, nb, price) => `Hands-on workshop in ${nb} · ${price || '$$'}`,
    show: (desc, nb, _price) => `Live entertainment in ${nb}`,
    concert: (desc, nb, _price) => `Live music in ${nb}`,
    party: (desc, nb, _price) => `${nb} nightlife`,
    exhibit: (desc, nb, _price) => `Art & culture in ${nb}`,
    market: (desc, nb, _price) => `Local vendors in ${nb}`,
    fitness: (desc, nb, price) => `${nb} fitness studio · ${price || '$$'}`,
    other: (desc, nb, _price) => `${nb} experience`,
  }

  let postCount = 0
  for (const entity of topEntities) {
    const tags = JSON.parse(entity.tags || '[]') as string[]
    const type = entity.entity_type
    const nb = entity.neighborhood ?? 'NYC'
    const price = entity.price_level ? '$'.repeat(entity.price_level) : ''
    const headlineFn = postHeadlines[type] ?? postHeadlines.other
    const subFn = postSubheadlines[type] ?? postSubheadlines.other
    const occurrence = entity.occurrences[0] ?? null

    const qualityScore = (
      entity.metadata_completeness * 0.4 +
      (entity.reviews ? ((entity.reviews.avg_rating ?? 3.5) - 1) / 4 * 0.3 : 0) +
      (entity.media.length > 0 ? 0.2 : 0) +
      entity.source_confidence * 0.1
    )

    // Don't create post if occurrence is past
    if (occurrence?.start_time && new Date(occurrence.start_time) < new Date()) continue

    await prisma.post.create({
      data: {
        entity_id: entity.id,
        occurrence_id: occurrence?.id ?? null,
        headline: headlineFn(entity.canonical_name, tags, nb),
        subheadline: subFn(entity.short_description ?? '', nb, price),
        body_markdown: entity.full_description ?? entity.short_description ?? '',
        cta_label: type === 'class' ? 'Book a class' : type === 'concert' || type === 'show' ? 'Get tickets' : 'Learn more',
        cta_url: entity.website ?? null,
        is_active: true,
        boost_score: qualityScore > 0.8 ? 2.0 : qualityScore > 0.65 ? 1.0 : 0.0,
        quality_score: Math.min(qualityScore, 1.0),
        expires_at: occurrence?.end_time ?? null,
        target_neighborhoods: JSON.stringify([nb]),
        target_tags: JSON.stringify(tags.slice(0, 5)),
      },
    })

    postCount++
    if (postCount >= 100) break
  }

  const totalPosts = await prisma.post.count()
  console.log(`✅ Total posts: ${totalPosts}`)

  // ─── Create demo user ──────────────────────────────────────────────────────

  const demoUser = await prisma.user.create({
    data: {
      session_token: 'demo-session-token-nyc-discovery',
      display_name: 'Demo User',
    },
  })

  await prisma.userPreferences.create({
    data: {
      user_id: demoUser.id,
      neighborhood_prefs: JSON.stringify(['Williamsburg', 'East Village', 'Park Slope']),
      interest_tags: JSON.stringify(['pizza', 'live music', 'cocktails', 'pottery', 'brunch']),
      price_sensitivity: 2,
      time_prefs: JSON.stringify(['weekday_evenings', 'weekend_days']),
      indoor_outdoor: 'both',
      solo_or_group: 'both',
      onboarding_completed: true,
    },
  })

  console.log(`👤 Demo user created: session token = demo-session-token-nyc-discovery`)

  await prisma.$disconnect()
  console.log('\n🎉 Seed complete!')
  console.log(`   Entities: ${totalEntities}`)
  console.log(`   Posts: ${totalPosts}`)
  console.log('   Demo session: demo-session-token-nyc-discovery')
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
