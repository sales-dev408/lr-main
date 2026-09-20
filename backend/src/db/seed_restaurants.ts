import { config } from '../config.js';
import { withDbClient, closePool } from './pool.js';

// Station name mapping from user data to database stops
const stationMapping: Record<string, string> = {
  'Thelda Williams Transit Center': 'Metro Parkway',
  'Mountain View/25th Ave': 'Mountain View / 25th Ave',
  '19th Ave/Dunlap': '19th Ave / Dunlap',
  '19th Ave & Northern Ave': 'Glendale / 19th Ave', // Map to nearest existing station
  '19th Ave. and Glendale': 'Glendale / 19th Ave', // Map to nearest existing station
  '19th ave and Montebello': 'Montebello / 19th Ave',
  '19th Ave and Camelback': '19th Ave / Camelback',
  '7th ave and Camelback': '7th Ave / Camelback',
  'Central & Camelback': 'Central Ave / Camelback',
  'Campbell/Central': 'Campbell / Central Ave',
  'Central and Indian School road': 'Indian School / Central Ave',
  'Central and Osborn': 'Osborn / Central Ave',
  'Central and Thomas': 'Thomas / Central Ave',
  'Central & McDowell': 'McDowell / Central Ave',
  'Central and Roosevelt': 'Roosevelt / Central Ave',
  'Central and Van Buren': 'Van Buren / Central Ave',
  'Central and Washington': 'Washington / Central Ave',
  'Central and Jefferson St': 'Jefferson / 1st Ave',
  'Central and Lincoln': 'Lincoln / Central Ave',
  'Central and buckeye': 'Buckeye / Central Ave',
  'Central and Pioneer': 'Jefferson / 1st Ave', // Map Pioneer to nearest existing station
  'Broadway and Central': 'Broadway / Central Ave',
  'Central and Roeser': 'Roeser / Central Ave',
  'Central and Southern': 'Southern / Central Ave',
  'Central and Baseline': 'Baseline / Central Ave',
};

// Restaurant/bar data organized by station
const restaurantsByStation: Record<string, Array<{
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  category: string;
}>> = {
  'Thelda Williams Transit Center': [
    { name: "Dos Arboles Restaurant & Cantina", address: "10220 N Metro Pkwy E, Phoenix, AZ 85051", phone: "(602) 997-5900", website: null, category: "Mexican Restaurant" },
    { name: "Hibachi Grill & Supreme Buffet", address: "10030 N Metro Pkwy E, Phoenix, AZ 85051", phone: "(602) 997-8889", website: null, category: "Buffet" },
    { name: "Texas Roadhouse", address: "10051 N Metro Pkwy E, Phoenix, AZ 85051", phone: "(602) 944-2118", website: "https://www.texasroadhouse.com", category: "Steakhouse" },
    { name: "Metro Sportz Bar & Billiards", address: "10111 N Metro Pkwy E, Phoenix, AZ 85051", phone: "(602) 997-5717", website: null, category: "Sports Bar" },
    { name: "Filiberto's Mexican Food", address: "10223 N Metro Pkwy E, Phoenix, AZ 85051", phone: null, website: null, category: "Mexican Food" },
    { name: "Jason's Deli", address: "10217 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(602) 870-8611", website: "https://www.jasonsdeli.com", category: "Deli" },
    { name: "Red Robin Gourmet Burgers", address: "10214 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(480) 448-6734", website: "https://www.redrobin.com", category: "American" },
    { name: "Donatos Pizza", address: "10214 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(480) 448-6734", website: "https://www.donatos.com", category: "Pizza" },
    { name: "Chili's Grill & Bar", address: "10237 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(602) 997-4600", website: "https://www.chilis.com", category: "American" },
    { name: "Mí Pueblo", address: "9620 N Metro Pkwy W #127, Phoenix, AZ 85051", phone: "(602) 870-2953", website: null, category: "Mexican" },
    { name: "Blazin' Mongolian BBQ", address: "9620 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(480) 361-4352", website: null, category: "Mongolian" },
    { name: "Peter Piper Pizza", address: "9620 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(602) 943-2807", website: "https://www.peterpiperpizza.com", category: "Pizza" },
    { name: "Subway – Walmart", address: "9602 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(602) 943-1046", website: "https://www.subway.com", category: "Sandwiches" },
    { name: "Arby's", address: "9641 N Metro Pkwy W, Phoenix, AZ 85051", phone: "(602) 870-8550", website: "https://www.arbys.com", category: "Fast Food" },
    { name: "Outback Steakhouse", address: "9801 N Black Canyon Hwy, Phoenix, AZ 85021", phone: "(602) 943-2226", website: "https://www.outback.com", category: "Steakhouse" },
    { name: "First Watch", address: "9645 N Black Canyon Hwy, Phoenix, AZ 85021", phone: null, website: "https://www.firstwatch.com", category: "Breakfast" },
    { name: "LongHorn Steakhouse", address: "10047 N Metro Pkwy E, Phoenix, AZ 85051", phone: null, website: "https://www.longhornsteakhouse.com", category: "Steakhouse" },
    { name: "Black Angus Steakhouse", address: "10021 N Metro Pkwy E, Phoenix, AZ 85051", phone: "(602) 944-1517", website: "https://www.blackangus.com", category: "Steakhouse" },
    { name: "Olive Garden", address: "10223 N Metro Pkwy E, Phoenix, AZ 85051", phone: "(602) 943-4573", website: "https://www.olivegarden.com", category: "Italian" },
    { name: "Red Lobster", address: "10220 N 28th Dr, Phoenix, AZ 85051", phone: null, website: "https://www.redlobster.com", category: "Seafood" },
    { name: "Panera Bread", address: "10430 N 28th Dr, Phoenix, AZ 85051", phone: null, website: "https://www.panerabread.com", category: "Cafe" },
    { name: "Pei Wei Asian Kitchen", address: "10450 N 28th Dr, Phoenix, AZ 85051", phone: null, website: "https://www.peiwei.com", category: "Asian" },
    { name: "Buffalo Wild Wings", address: "2700 W North Ln, Phoenix, AZ 85051", phone: null, website: "https://www.buffalowildwings.com", category: "Sports Bar" },
    { name: "Raising Cane's", address: "2715 W Peoria Ave, Phoenix, AZ 85029", phone: "(602) 795-3550", website: "https://www.raisingcanes.com", category: "Fast Food" },
    { name: "MOD Pizza", address: "3121 W Peoria Ave #101, Phoenix, AZ 85029", phone: "(623) 243-9724", website: "https://www.modpizza.com", category: "Pizza" },
    { name: "Chipotle Mexican Grill", address: "3039 W Peoria Ave, Phoenix, AZ 85029", phone: "(602) 944-5060", website: "https://www.chipotle.com", category: "Mexican" },
    { name: "Chick-fil-A", address: "3111 W Peoria Ave, Phoenix, AZ 85029", phone: null, website: "https://www.chick-fil-a.com", category: "Fast Food" },
    { name: "Wingstop", address: "2815 W Peoria Ave #118, Phoenix, AZ 85029", phone: null, website: "https://www.wingstop.com", category: "Chicken" },
  ],
  'Mountain View/25th Ave': [
    { name: "Red Dog Cafe", address: "10020 N 25th Ave, Phoenix, AZ 85021", phone: "(602) 674-6784", website: null, category: "Cafe" },
    { name: "Sonic Drive-In", address: "9414 N 25th Ave, Phoenix, AZ 85021", phone: "(602) 266-4300", website: "https://www.sonicdrivein.com", category: "Fast Food" },
    { name: "Jack in the Box", address: "8951 N 19th Ave, Phoenix, AZ 85021", phone: "(602) 944-0710", website: "https://www.jackinthebox.com", category: "Fast Food" },
  ],
  '19th Ave/Dunlap': [
    { name: "Subway", address: "1945 W Dunlap Ave, Ste 7, Phoenix, AZ 85021", phone: "(602) 861-3952", website: "https://www.subway.com", category: "Sandwiches" },
    { name: "Don Burrencio Mexican Food", address: "1905 W Dunlap Ave, Phoenix, AZ 85021", phone: null, website: null, category: "Mexican" },
    { name: "QuikTrip food counter", address: "9010 N 19th Ave, Phoenix, AZ 85021", phone: null, website: "https://www.quiktrip.com", category: "Convenience" },
    { name: "Taco Bell", address: "9019 N 19th Ave, Phoenix, AZ 85021", phone: null, website: "https://www.tacobell.com", category: "Mexican" },
  ],
  '19th Ave & Northern Ave': [
    { name: "Del Taco", address: "1901 W Northern Ave, Phoenix, AZ 85021", phone: "602-995-1144", website: "https://www.deltaco.com", category: "Mexican" },
    { name: "McDonald's", address: "1905 W Northern Ave, Phoenix, AZ 85021", phone: "602-995-2650", website: "https://www.mcdonalds.com", category: "Fast Food" },
    { name: "Renegade Coffee Company", address: "1912 W Northern Ave, Phoenix, AZ 85021", phone: "480-284-6258", website: null, category: "Coffee" },
    { name: "Dunkin'", address: "1931 W Northern Ave, Phoenix, AZ 85021", phone: "602-242-1861", website: "https://www.dunkindonuts.com", category: "Coffee" },
    { name: "Rally's", address: "1935 W Northern Ave, Phoenix, AZ 85021", phone: "623-401-9330", website: "https://www.rallys.com", category: "Fast Food" },
    { name: "IHOP", address: "2000 W Northern Ave, Phoenix, AZ 85021", phone: "602-995-4044", website: "https://www.ihop.com", category: "Breakfast" },
    { name: "Tacos El Jefe", address: "1810 W Northern Ave, Phoenix, AZ 85021", phone: "480-621-9279", website: null, category: "Mexican" },
    { name: "Tumi Asian Fresh & Sushi", address: "1810 W Northern Ave, Ste A-2, Phoenix, AZ 85021", phone: "480-534-4931", website: null, category: "Sushi" },
    { name: "Ms. Martha's Caribbean Kitchen", address: "1820 W Northern Ave, Ste 110, Phoenix, AZ 85021", phone: "602-675-2212", website: null, category: "Caribbean" },
    { name: "Tacos Chisco Bar & Grill", address: "1820 W Northern Ave, #140, Phoenix, AZ 85021", phone: "602-607-5065", website: null, category: "Mexican" },
    { name: "The Buffalo Spot", address: "2080 W Northern Ave, #100, Phoenix, AZ 85021", phone: "602-973-1515", website: null, category: "Chicken" },
    { name: "Barro's Pizza – 19th Ave & Northern", address: "7019 N 19th Ave, Phoenix, AZ 85021", phone: "623-288-9998", website: "https://www.barrospizza.com", category: "Pizza" },
  ],
  '19th Ave. and Glendale': [
    { name: "Panda Express", address: "1901 W Glendale Ave, Phoenix, AZ 85021", phone: "602-848-2979", website: "https://www.pandaexpress.com", category: "Chinese" },
    { name: "Starbucks", address: "1970 W Glendale Ave, Phoenix, AZ 85021", phone: "602-675-8394", website: "https://www.starbucks.com", category: "Coffee" },
    { name: "Filiberto's Mexican Food", address: "1727 W Glendale Ave, Phoenix, AZ 85021", phone: "602-841-0603", website: null, category: "Mexican" },
    { name: "Restaurant Atoyac", address: "1830 W Glendale Ave, Phoenix, AZ 85021", phone: "602-864-2746", website: null, category: "Mexican" },
    { name: "Stacy's Off Da Hook BBQ & Soul Food", address: "1804 W Glendale Ave, Phoenix, AZ 85021", phone: null, website: null, category: "BBQ" },
  ],
  '19th ave and Montebello': [
    { name: "The Taco Spot - Christown", address: "1703 W Bethany Home Rd, Phoenix, AZ 85015", phone: "602-242-0975", website: null, category: "Mexican" },
    { name: "Chick-fil-A – Bethany Home", address: "1850 W Bethany Home Rd, Phoenix, AZ 85015", phone: "602-654-1850", website: "https://www.chick-fil-a.com", category: "Fast Food" },
    { name: "Chipotle Mexican Grill – 19th & Bethany", address: "1818 W Bethany Home Rd, Phoenix, AZ 85015", phone: "623-207-7338", website: "https://www.chipotle.com", category: "Mexican" },
    { name: "Papa Joe's Fish & Nque", address: "2019 W Bethany Home Rd, Phoenix, AZ 85015", phone: "602-973-7003", website: null, category: "Seafood" },
    { name: "Oaxaca Restaurant", address: "2316 W Bethany Home Rd, Phoenix, AZ 85015", phone: "602-242-3840", website: null, category: "Mexican" },
    { name: "Samurai Sam's Teriyaki Grill", address: "2316 W Bethany Home Rd, Phoenix, AZ 85015", phone: "602-242-6755", website: null, category: "Japanese" },
  ],
  '19th Ave and Camelback': [
    { name: "Barba Roja Restaurant & Bar", address: "2050 W Camelback Rd, Phoenix, AZ 85015", phone: "(480) 486-9967", website: null, category: "Mexican" },
    { name: "Church's Texas Chicken", address: "1906 W Camelback Rd, Phoenix, AZ 85015", phone: "(602) 242-4386", website: "https://www.churchs.com", category: "Chicken" },
    { name: "AZ Taco King", address: "2030 W Camelback Rd, Phoenix, AZ 85015", phone: "(480) 410-1914", website: null, category: "Mexican" },
    { name: "Pepe's Taco Villa", address: "2108 W Camelback Rd, Phoenix, AZ 85015", phone: "(602) 242-0379", website: null, category: "Mexican" },
    { name: "Popeyes Louisiana Kitchen", address: "2203 W Camelback Rd, Phoenix, AZ 85015", phone: "(602) 973-1052", website: "https://www.popeyes.com", category: "Chicken" },
    { name: "Saigon Bistro Camelback", address: "2211 W Camelback Rd #178, Phoenix, AZ 85015", phone: "(480) 287-9001", website: null, category: "Vietnamese" },
    { name: "Subway", address: "2211 W Camelback Rd, Phoenix, AZ 85015", phone: null, website: "https://www.subway.com", category: "Sandwiches" },
    { name: "Country Boys Restaurant", address: "2330 W Camelback Rd, Phoenix, AZ 85015", phone: "(602) 433-2192", website: null, category: "American" },
    { name: "Phở Thành Restaurant", address: "1702 W Camelback Rd, Phoenix, AZ 85015", phone: "(602) 242-1979", website: null, category: "Vietnamese" },
    { name: "Kwan & Wok Chinese Fast Food", address: "1702 W Camelback Rd, Phoenix, AZ 85015", phone: "(602) 246-7442", website: null, category: "Chinese" },
    { name: "Milk Run Premium Ice Cream & Boba", address: "1702 W Camelback Rd, Phoenix, AZ 85015", phone: "(602) 795-1863", website: null, category: "Ice Cream" },
  ],
  '7th ave and Camelback': [
    { name: "McDonald's", address: "750 W Camelback Rd, Phoenix, AZ 85013", phone: "602-265-6722", website: "https://www.mcdonalds.com", category: "Fast Food" },
    { name: "Camelback PHỞ", address: "702 W Camelback Rd, Suite A1, Phoenix, AZ 85013", phone: "602-358-7037", website: null, category: "Vietnamese" },
    { name: "Taqueria Los Yaquis", address: "727 W Camelback Rd, Phoenix, AZ 85013", phone: "602-476-9976", website: null, category: "Mexican" },
    { name: "Charlie's Phoenix", address: "727 W Camelback Rd, Phoenix, AZ 85013", phone: "602-265-0224", website: null, category: "American" },
    { name: "Tesota", address: "300 W Camelback Rd, Phoenix, AZ 85013", phone: "602-989-8456", website: null, category: "Mexican" },
    { name: "Toasted Owl Cafe", address: "300 W Camelback Rd, Phoenix, AZ 85013", phone: "602-612-4930", website: null, category: "Cafe" },
  ],
  'Central & Camelback': [
    { name: "Applebee's", address: "2 E Camelback Rd, Phoenix, AZ 85012", phone: "(602) 266-3330", website: "https://www.applebees.com", category: "American" },
    { name: "The Henry", address: "2 E Camelback Rd, Phoenix, AZ 85012", phone: "(480) 393-4878", website: null, category: "American" },
    { name: "Prime Chinese Restaurant", address: "24 W Camelback Rd, Phoenix, AZ 85013", phone: null, website: null, category: "Chinese" },
    { name: "Zookz Sandwiches", address: "100 E Camelback Rd #192, Phoenix, AZ 85012", phone: "(602) 279-0906", website: null, category: "Sandwiches" },
    { name: "Elly's Brunch & Cafe", address: "100 E Camelback Rd #166, Phoenix, AZ 85012", phone: "(602) 603-9600", website: null, category: "Brunch" },
    { name: "Shake Shack", address: "100 E Camelback Rd #100, Phoenix, AZ 85012", phone: "(602) 903-3240", website: "https://www.shakeshack.com", category: "American" },
    { name: "Let's Toast", address: "100 E Camelback Rd #164, Phoenix, AZ 85012", phone: "(623) 349-4155", website: null, category: "Bar" },
    { name: "Lou Malnati's Pizzeria", address: "100 E Camelback Rd, Phoenix, AZ 85012", phone: "(602) 892-9998", website: "https://www.loumalnatis.com", category: "Pizza" },
    { name: "Sweet Tomatoes", address: "52 E Camelback Rd, Phoenix, AZ 85012", phone: null, website: null, category: "Salad" },
    { name: "Doc's Place", address: "40 E Camelback Rd, Phoenix, AZ 85012", phone: null, website: null, category: "American" },
    { name: "Johnny's Uptown Restaurant", address: "40 E Camelback Rd, Phoenix, AZ 85012", phone: null, website: null, category: "American" },
    { name: "Cheese 'n Stuff", address: "5042 N Central Ave, Phoenix, AZ 85012", phone: null, website: null, category: "Deli" },
    { name: "Dairy Queen", address: "5050 N Central Ave, Phoenix, AZ 85012", phone: null, website: "https://www.dairyqueen.com", category: "Ice Cream" },
    { name: "St. Francis", address: "111 E Camelback Rd, Phoenix, AZ 85012", phone: "(602) 200-8111", website: null, category: "American" },
    { name: "Toasted Owl Cafe", address: "300 W Camelback Rd, Phoenix, AZ 85013", phone: "(602) 612-4930", website: null, category: "Cafe" },
    { name: "First Draft Book Bar", address: "300 W Camelback Rd, Phoenix, AZ 85013", phone: null, website: null, category: "Bar" },
    { name: "Postino Central", address: "5144 N Central Ave, Phoenix, AZ 85012", phone: "(602) 274-5144", website: "https://postinowinecafe.com", category: "Wine Bar" },
    { name: "Federal Pizza", address: "5210 N Central Ave #104, Phoenix, AZ 85012", phone: "(602) 795-2520", website: null, category: "Pizza" },
  ],
  'Campbell/Central': [
    { name: "Lux Central", address: "4402 N Central Ave, Phoenix, AZ 85012", phone: "(602) 327-1396", website: "https://luxcentral.com", category: "Cafe" },
    { name: "Pane Bianco Central", address: "4404 N Central Ave, Phoenix, AZ 85012", phone: "(602) 234-2100", website: "https://panebianco.com", category: "Italian" },
    { name: "fà-me cafe", address: "4700 N Central Ave, Phoenix, AZ 85012", phone: "(602) 314-4660", website: null, category: "Cafe" },
    { name: "Persepshen", address: "4700 N Central Ave, Phoenix, AZ 85012", phone: "(602) 935-2932", website: null, category: "Asian" },
    { name: "Yama Sushi House", address: "4750 N Central Ave #150, Phoenix, AZ 85012", phone: "(602) 264-4260", website: null, category: "Sushi" },
  ],
  'Central and Indian School road': [
    { name: "Clever Koi", address: "4236 N Central Ave #100, Phoenix, AZ 85012", phone: "(602) 222-3474", website: "https://www.cleverkoi.com", category: "Asian" },
    { name: "Across The Pond", address: "4236 N Central Ave Ste 101, Phoenix, AZ 85012", phone: "(602) 296-5629", website: null, category: "Sushi" },
    { name: "Chopper Johns", address: "2547 E Indian School Rd, Phoenix, AZ 85016", phone: "(602) 955-0881", website: null, category: "Bar" },
    { name: "Yoshi's", address: "4202 N 7th Ave, Phoenix, AZ 85013", phone: null, website: null, category: "Japanese" },
    { name: "George & Dragon English Pub", address: "4240 N Central Ave, Phoenix, AZ 85012", phone: "(602) 241-0018", website: null, category: "Pub" },
    { name: "Thai E-San", address: "616 W Indian School Rd, Phoenix, AZ 85013", phone: "(602) 297-8888", website: null, category: "Thai" },
    { name: "McDonald's", address: "711 W Indian School Rd, Phoenix, AZ 85013", phone: "(602) 277-5512", website: "https://www.mcdonalds.com", category: "Fast Food" },
  ],
  'Central and Osborn': [
    { name: "Alexi's Grill", address: "3550 N Central Ave #120, Phoenix, AZ 85012", phone: "(602) 279-0982", website: null, category: "Italian" },
    { name: "Café 36", address: "333 E Osborn Rd, Phoenix, AZ 85012", phone: null, website: null, category: "Cafe" },
    { name: "First Watch", address: "3110 N Central Ave, Phoenix, AZ 85012", phone: "(602) 248-3897", website: "https://www.firstwatch.com", category: "Breakfast" },
    { name: "Fired Pie", address: "3110 N Central Ave #107, Phoenix, AZ 85012", phone: "(602) 266-1183", website: "https://www.firedpie.com", category: "Pizza" },
    { name: "Kobalt", address: "3110 N Central Ave #175, Phoenix, AZ 85012", phone: "(602) 264-5307", website: null, category: "Bar" },
    { name: "Taco Guild", address: "546 E Osborn Rd, Phoenix, AZ 85012", phone: "(602) 264-4143", website: null, category: "Mexican" },
    { name: "China Chili", address: "302 E Flower St, Phoenix, AZ 85012", phone: "(602) 266-4463", website: null, category: "Chinese" },
    { name: "Thai Basil", address: "3110 N Central Ave, Phoenix, AZ 85012", phone: "(602) 274-5020", website: null, category: "Thai" },
    { name: "Ocotillo Restaurant", address: "3243 N 3rd St #A, Phoenix, AZ 85012", phone: "(602) 687-9080", website: "https://www.ocotillophx.com", category: "American" },
    { name: "Cranberry Hills Eatery", address: "3003 N Central Ave #118, Phoenix, AZ 85012", phone: "(602) 230-2030", website: null, category: "Deli" },
    { name: "Yoshi's Restaurant", address: "4050 N Central Ave, Phoenix, AZ 85012", phone: "(602) 274-6470", website: null, category: "Japanese" },
    { name: "Gadzooks Enchiladas & Soup", address: "3313 N 7th St, Phoenix, AZ 85014", phone: "(602) 279-5080", website: null, category: "Mexican" },
    { name: "Urban Beans", address: "350 W Osborn Rd, Phoenix, AZ 85013", phone: null, website: null, category: "Coffee" },
  ],
  'Central and Thomas': [
    { name: "Pinos Pizza Al Centro", address: "139 W Thomas Rd, Phoenix, AZ 85013", phone: null, website: null, category: "Pizza" },
    { name: "El Zaguan Cafe", address: "2828 N Central Ave, Phoenix, AZ 85012", phone: null, website: null, category: "Mexican" },
    { name: "Panera Bread", address: "2845 N Central Ave, Phoenix, AZ 85012", phone: null, website: "https://www.panerabread.com", category: "Cafe" },
    { name: "First Watch", address: "2525 N Central Ave, Phoenix, AZ 85012", phone: null, website: "https://www.firstwatch.com", category: "Breakfast" },
    { name: "Honey Bear's BBQ", address: "5012 N Central Ave, Phoenix, AZ 85012", phone: null, website: null, category: "BBQ" },
    { name: "Wild Thaiger", address: "2631 N Central Ave, Phoenix, AZ 85012", phone: null, website: null, category: "Thai" },
    { name: "Switch Restaurant & Wine Bar", address: "2603 N Central Ave, Phoenix, AZ 85012", phone: null, website: null, category: "Wine Bar" },
    { name: "Durant's", address: "2611 N Central Ave, Phoenix, AZ 85012", phone: null, website: null, category: "Steakhouse" },
    { name: "5th Avenue Cafe", address: "501 W Thomas Rd, Phoenix, AZ 85013", phone: null, website: null, category: "Breakfast" },
    { name: "Vayal's Indian Kitchen", address: "507 W Thomas Rd, Phoenix, AZ 85013", phone: null, website: null, category: "Indian" },
  ],
  'Central & McDowell': [
    { name: "The Old Spaghetti Factory", address: "1418 N Central Ave, Phoenix, AZ 85012", phone: "(602) 257-0380", website: "https://www.osf.com", category: "Italian" },
    { name: "Forno 301", address: "1616 N Central Ave #104, Phoenix, AZ 85012", phone: "(480) 787-5654", website: null, category: "Italian" },
    { name: "Pizza People Pub", address: "1326 N Central Ave, Phoenix, AZ 85012", phone: "(602) 795-7954", website: null, category: "Pizza" },
    { name: "East Bite Mediterranean Cuisine", address: "101 E McDowell Rd, Phoenix, AZ 85004", phone: "(602) 686-8935", website: null, category: "Mediterranean" },
    { name: "Basilic Vietnamese Kitchen", address: "1335 N 7th St, Phoenix, AZ 85006", phone: null, website: null, category: "Vietnamese" },
  ],
  'Central and Roosevelt': [
    { name: "Rough Rider", address: "1001 N Central Ave, Phoenix, AZ 85012", phone: "(602) 675-0439", website: "https://roughrideraz.com", category: "Bar" },
    { name: "Industry Standard", address: "128 E Roosevelt St, Phoenix, AZ 85004", phone: "(623) 230-2303", website: null, category: "Bar" },
    { name: "Arizona Wilderness DTPHX", address: "201 E Roosevelt St, Phoenix, AZ 85004", phone: "(480) 462-1836", website: "https://arizonawilderness.com", category: "Brewery" },
    { name: "Taco Chelo", address: "501 E Roosevelt St, Phoenix, AZ 85004", phone: "(602) 368-5316", website: "https://www.tacochelo.com", category: "Mexican" },
    { name: "SoSoBa", address: "214 W Roosevelt St, Phoenix, AZ 85003", phone: "(602) 795-1005", website: null, category: "Asian" },
    { name: "Sake Haus", address: "214 W Roosevelt St, Phoenix, AZ 85003", phone: "(602) 218-6734", website: null, category: "Sushi" },
    { name: "Pedal Haus Brewery", address: "214 W Roosevelt St, Ste 4, Phoenix, AZ 85003", phone: "(623) 213-8229", website: "https://pedalhaus.com", category: "Brewery" },
    { name: "Pretty Penny", address: "509 E Roosevelt St, Phoenix, AZ 85004", phone: "(602) 960-0406", website: null, category: "Bar" },
    { name: "Taco Boy's", address: "620 E Roosevelt St, Phoenix, AZ 85004", phone: "(602) 675-3962", website: null, category: "Mexican" },
    { name: "Culinary Gangster", address: "513 E Roosevelt St, Phoenix, AZ 85004", phone: "(480) 398-7079", website: null, category: "American" },
    { name: "Huarachis Taqueria", address: "814 N Central Ave, Phoenix, AZ 85012", phone: "(602) 773-1413", website: null, category: "Mexican" },
    { name: "Palma", address: "903 N 2nd St, Phoenix, AZ 85004", phone: "(602) 580-0000", website: null, category: "Mexican" },
  ],
  'Central and Van Buren': [
    { name: "Stardust Pinbar", address: "401 W Van Buren St, Ste C, Phoenix, AZ 85003", phone: "(602) 354-2931", website: null, category: "Bar" },
    { name: "Ziggys Magic Pizza Shop", address: "401 W Van Buren St, Ste B, Phoenix, AZ 85003", phone: "(602) 354-3004", website: null, category: "Pizza" },
    { name: "Valley Bar", address: "130 N Central Ave, Phoenix, AZ 85004", phone: "(602) 368-3121", website: "https://valleybarphx.com", category: "Bar" },
    { name: "Condesa Phoenix", address: "130 N Central Ave, Ste 100, Phoenix, AZ 85004", phone: "(602) 892-5550", website: null, category: "Mexican" },
    { name: "Centrico", address: "101 N 1st Ave, Phoenix, AZ 85003", phone: "(602) 254-8226", website: null, category: "Mexican" },
    { name: "Jacy & Dakota's", address: "333 N Central Ave, Phoenix, AZ 85004", phone: "(602) 429-3600", website: null, category: "American" },
    { name: "Séamus McCaffrey's Irish Pub", address: "18 W Monroe St, Phoenix, AZ 85003", phone: "(602) 253-6081", website: null, category: "Irish Pub" },
    { name: "Cornish Pasty Co.", address: "7 W Monroe St, Phoenix, AZ 85003", phone: "(602) 374-8500", website: "https://cornishpastyco.com", category: "British" },
    { name: "Ramen Kagawa", address: "111 W Monroe St #130, Phoenix, AZ 85003", phone: "(602) 675-0833", website: null, category: "Ramen" },
    { name: "Zen Thai Cafe", address: "110 N Central Ave, Phoenix, AZ 85004", phone: "(602) 340-8899", website: null, category: "Thai" },
    { name: "Thai Basil Signature", address: "114 W Adams St, Ste 104, Phoenix, AZ 85003", phone: "(602) 759-8737", website: null, category: "Thai" },
    { name: "El Zaguan Bistro", address: "16 W Adams St, Phoenix, AZ 85003", phone: "(602) 877-3033", website: null, category: "Mexican" },
    { name: "Adams Table", address: "150 W Adams St, Phoenix, AZ 85003", phone: "(602) 388-4888", website: null, category: "American" },
    { name: "Dust Cutter", address: "50 E Adams St, Phoenix, AZ 85003", phone: "(602) 333-0000", website: null, category: "Bar" },
    { name: "Wren & Wolf", address: "2 N Central Ave, Ste 101, Phoenix, AZ 85004", phone: "(602) 562-3510", website: null, category: "Steakhouse" },
    { name: "The Arrogant Butcher", address: "2 E Jefferson St #150, Phoenix, AZ 85004", phone: "(602) 324-8502", website: null, category: "Steakhouse" },
    { name: "Floor 13 Rooftop Bar", address: "15 E Monroe St, Phoenix, AZ 85003", phone: "(602) 396-7168", website: null, category: "Rooftop Bar" },
    { name: "OBON Sushi + Bar + Ramen - Phoenix", address: "1 E Washington St, Phoenix, AZ 85004", phone: "(602) 831-0004", website: null, category: "Sushi" },
    { name: "Cocina 10", address: "308 N 2nd Ave, Phoenix, AZ 85004", phone: "(602) 716-2222", website: null, category: "Mexican" },
    { name: "Harumi Sushi Bar", address: "101 N 1st Ave, Phoenix, AZ 85003", phone: null, website: null, category: "Sushi" },
    { name: "Huarachis Taqueria", address: "814 N Central Ave, Phoenix, AZ 85012", phone: "(602) 773-1413", website: null, category: "Mexican" },
    { name: "BARCOA Agaveria", address: "829 N 1st Ave, Phoenix, AZ 85003", phone: "(602) 980-0788", website: null, category: "Bar" },
  ],
  'Central and Washington': [
    { name: "Pigtails Downtown", address: "1 E Washington St #128, Phoenix, AZ 85004", phone: "(602) 675-4416", website: null, category: "Cocktail Bar" },
    { name: "Coabana", address: "1 E Washington St #124, Phoenix, AZ 85004", phone: "(480) 716-3463", website: null, category: "Cuban" },
    { name: "Dog Haus Biergarten", address: "1 E Washington St #120, Phoenix, AZ 85004", phone: "(480) 275-5161", website: null, category: "Bar" },
    { name: "Ingo's Tasty Food", address: "101 E Washington St, Ste A, Phoenix, AZ 85004", phone: "(602) 825-3000", website: null, category: "American" },
    { name: "Blanco Cocina + Cantina", address: "123 E Washington St, Phoenix, AZ 85004", phone: "(602) 899-8102", website: null, category: "Mexican" },
    { name: "The Whining Pig Downtown", address: "201 E Washington St #104, Phoenix, AZ 85004", phone: "(602) 603-9987", website: null, category: "Beer Bar" },
    { name: "Mancuso's Restaurant", address: "201 E Washington St, Phoenix, AZ 85004", phone: "(480) 556-0770", website: null, category: "Italian" },
    { name: "STK Steakhouse", address: "201 E Washington St, Phoenix, AZ 85004", phone: "(480) 781-3023", website: "https://www.stksteakhouse.com", category: "Steakhouse" },
    { name: "Stadium Sports Bar & Lounge", address: "50 W Jefferson St #280, Phoenix, AZ 85003", phone: "(480) 508-4791", website: null, category: "Sports Bar" },
    { name: "Bitter & Twisted Cocktail Parlour", address: "1 W Jefferson St, Phoenix, AZ 85003", phone: "(602) 340-1924", website: null, category: "Cocktail Bar" },
    { name: "Wren & Wolf", address: "2 N Central Ave #101, Phoenix, AZ 85004", phone: "(602) 562-3510", website: null, category: "Steakhouse" },
    { name: "Little Rituals", address: "132 S Central Ave, 4th Floor, Phoenix, AZ 85004", phone: "(602) 603-2050", website: null, category: "Cocktail Bar" },
    { name: "Valley Bar", address: "130 N Central Ave, Phoenix, AZ 85004", phone: "(602) 368-3121", website: "https://valleybarphx.com", category: "Bar" },
    { name: "Centrico", address: "101 N 1st Ave, Phoenix, AZ 85003", phone: "(602) 254-8226", website: null, category: "Mexican" },
    { name: "Hanny's", address: "40 N 1st St, Phoenix, AZ 85004", phone: "(602) 252-2285", website: null, category: "American" },
    { name: "Harumi Sushi & Sake", address: "101 N 1st Ave, Phoenix, AZ 85003", phone: null, website: null, category: "Sushi" },
    { name: "The Rose Garden", address: "101 N 1st Ave, Phoenix, AZ 85003", phone: null, website: null, category: "Restaurant" },
    { name: "Floor 13 Rooftop Bar", address: "15 E Monroe St, Phoenix, AZ 85003", phone: "(602) 396-7168", website: null, category: "Rooftop Bar" },
    { name: "Seamus McCaffrey's", address: "18 W Monroe St, Phoenix, AZ 85003", phone: "(602) 253-6081", website: null, category: "Irish Pub" },
    { name: "Cornish Pasty Co.", address: "7 W Monroe St, Phoenix, AZ 85003", phone: "(602) 374-8500", website: "https://cornishpastyco.com", category: "British" },
    { name: "Ramen Kagawa", address: "111 W Monroe St #130, Phoenix, AZ 85003", phone: "(602) 675-0833", website: null, category: "Ramen" },
    { name: "El Zaguan Bistro", address: "16 W Adams St, Phoenix, AZ 85003", phone: "(602) 877-3033", website: null, category: "Mexican" },
    { name: "Paradise Hawaiian BBQ", address: "18 W Adams St, Phoenix, AZ 85003", phone: null, website: null, category: "Hawaiian" },
    { name: "Zen Thai Cafe", address: "110 N Central Ave, Phoenix, AZ 85004", phone: "(602) 340-8899", website: null, category: "Thai" },
    { name: "Thai Basil Signature", address: "114 W Adams St #104, Phoenix, AZ 85003", phone: "(602) 759-8737", website: null, category: "Thai" },
    { name: "Dust Cutter", address: "50 E Adams St, Phoenix, AZ 85003", phone: "(602) 333-0000", website: null, category: "Bar" },
    { name: "Arizona Deli Company", address: "1 N Central Ave #115, Phoenix, AZ 85004", phone: null, website: null, category: "Deli" },
    { name: "Nick The Greek", address: "11 W Washington St #120, Phoenix, AZ 85003", phone: null, website: null, category: "Greek" },
    { name: "Yogi's Grill", address: "1 E Washington St #175, Phoenix, AZ 85004", phone: null, website: null, category: "Japanese" },
    { name: "Chico Malo", address: "50 W Jefferson St, Phoenix, AZ 85003", phone: null, website: null, category: "Mexican" },
    { name: "Copper Blues Rock Pub & Kitchen", address: "50 W Jefferson St, Phoenix, AZ 85003", phone: null, website: null, category: "Bar" },
    { name: "Blue Hound Kitchen & Cocktails", address: "2 E Jefferson St, Phoenix, AZ 85004", phone: "(602) 258-0231", website: null, category: "American" },
    { name: "OBON Sushi + Bar + Ramen", address: "2 E Jefferson St #108, Phoenix, AZ 85004", phone: null, website: null, category: "Sushi" },
    { name: "The Arrogant Butcher", address: "2 E Jefferson St, Phoenix, AZ 85004", phone: null, website: null, category: "Steakhouse" },
    { name: "Tom's Watch Bar", address: "3 S 2nd St, Phoenix, AZ 85004", phone: null, website: null, category: "Sports Bar" },
    { name: "Mo' Bettahs", address: "50 W Jefferson St #180, Phoenix, AZ 85003", phone: null, website: null, category: "Hawaiian" },
    { name: "Bad Ass Coffee of Hawaii", address: "50 W Jefferson St #1, Phoenix, AZ 85003", phone: null, website: null, category: "Coffee" },
  ],
  'Central and Jefferson St': [
    { name: "Bitter & Twisted Cocktail Parlour", address: "1 W Jefferson St, Phoenix, AZ 85003", phone: "(602) 340-1924", website: null, category: "Cocktail Bar" },
    { name: "Casa de Julia Restaurant Bar", address: "45 W Jefferson St, Phoenix, AZ 85003", phone: "(480) 257-2424", website: null, category: "Restaurant" },
    { name: "Chico Malo", address: "50 W Jefferson St, Phoenix, AZ 85003", phone: "(602) 603-9363", website: null, category: "Mexican" },
    { name: "Blue Hound Kitchen & Cocktails", address: "2 E Jefferson St, Phoenix, AZ 85004", phone: "(602) 258-0231", website: null, category: "American" },
    { name: "The Arrogant Butcher", address: "2 E Jefferson St #150, Phoenix, AZ 85004", phone: "(602) 324-8502", website: null, category: "Steakhouse" },
    { name: "ROSSO ITALIAN", address: "2 E Jefferson St #113, Phoenix, AZ 85004", phone: "(602) 218-6001", website: null, category: "Italian" },
    { name: "OBON Sushi Bar Ramen", address: "2 E Jefferson St #108, Phoenix, AZ 85004", phone: "(602) 831-0004", website: null, category: "Sushi" },
    { name: "Breakfast Club", address: "2 E Jefferson St, Phoenix, AZ 85004", phone: "(602) 354-7284", website: null, category: "Breakfast" },
    { name: "Stadium Sports Bar & Lounge", address: "50 W Jefferson St #280, Phoenix, AZ 85003", phone: "(480) 508-4791", website: null, category: "Sports Bar" },
    { name: "Little Rituals", address: "132 S Central Ave, 4th Floor, Phoenix, AZ 85004", phone: "(602) 603-2050", website: null, category: "Cocktail Bar" },
    { name: "Pigtails Downtown", address: "1 E Washington St #128, Phoenix, AZ 85004", phone: "(602) 675-4416", website: null, category: "Cocktail Bar" },
    { name: "Wren & Wolf", address: "2 N Central Ave #101, Phoenix, AZ 85004", phone: "(602) 562-3510", website: null, category: "Steakhouse" },
    { name: "Hanny's", address: "40 N 1st St, Phoenix, AZ 85004", phone: "(602) 252-2285", website: null, category: "American" },
    { name: "The Kettle Black Kitchen & Pub", address: "1 N 1st St #108, Phoenix, AZ 85004", phone: "(602) 651-1185", website: null, category: "Pub" },
    { name: "Céntrico", address: "101 N 1st Ave, Phoenix, AZ 85003", phone: "(602) 254-8226", website: null, category: "Mexican" },
    { name: "Ingo's Tasty Food – Downtown", address: "101 E Washington St, Phoenix, AZ 85004", phone: "(602) 825-3000", website: null, category: "American" },
    { name: "Valley Bar", address: "130 N Central Ave, Phoenix, AZ 85004", phone: "(602) 368-3121", website: "https://valleybarphx.com", category: "Bar" },
    { name: "Condesa Phoenix", address: "130 N Central Ave #102, Phoenix, AZ 85004", phone: "(602) 892-5550", website: null, category: "Mexican" },
    { name: "Crown Public House", address: "333 E Jefferson St, Phoenix, AZ 85004", phone: "(602) 368-4344", website: null, category: "Pub" },
    { name: "Séamus McCaffrey's Irish Pub", address: "18 W Monroe St, Phoenix, AZ 85003", phone: "(602) 253-6081", website: null, category: "Irish Pub" },
    { name: "The Duce", address: "525 S Central Ave, Phoenix, AZ 85004", phone: "(602) 866-3823", website: "https://theducephx.com", category: "Bar" },
  ],
  'Central and Lincoln': [
    { name: "The Duce", address: "525 S Central Ave, Phoenix, AZ 85004", phone: "602-866-3823", website: "https://theducephx.com", category: "Bar" },
    { name: "The Kettle Black Kitchen & Pub", address: "1 N 1st St #108, Phoenix, AZ 85004", phone: "602-651-1185", website: null, category: "Pub" },
    { name: "The Whining Pig Downtown", address: "201 E Washington St #104, Phoenix, AZ 85004", phone: "602-603-9987", website: null, category: "Bar" },
    { name: "Blue Hound Kitchen & Cocktails", address: "2 E Jefferson St, Phoenix, AZ 85004", phone: "602-258-0231", website: null, category: "American" },
    { name: "The Arrogant Butcher", address: "2 E Jefferson St #150, Phoenix, AZ 85004", phone: "602-324-8502", website: null, category: "Steakhouse" },
    { name: "Chico Malo", address: "50 W Jefferson St, Phoenix, AZ 85003", phone: "602-603-9363", website: null, category: "Mexican" },
    { name: "Bitter & Twisted Cocktail Parlour", address: "1 W Jefferson St, Phoenix, AZ 85003", phone: "602-340-1924", website: null, category: "Cocktail Bar" },
    { name: "Pigtails Downtown", address: "1 E Washington St #128, Phoenix, AZ 85004", phone: "602-675-4416", website: null, category: "Cocktail Bar" },
    { name: "Last Exit Live", address: "717 S Central Ave, Phoenix, AZ 85004", phone: "602-271-7000", website: null, category: "Live Music" },
    { name: "Tee Pee Tap Room", address: "602 E Lincoln St, Phoenix, AZ 85004", phone: "602-340-8787", website: null, category: "Mexican" },
  ],
  'Central and buckeye': [
    { name: "Lo-Lo's Chicken & Waffles", address: "1220 S Central Ave, Phoenix, AZ 85003", phone: "(602) 340-1304", website: "https://www.loloschickenandwaffles.com", category: "Soul Food" },
    { name: "Taqueria La Hacienda", address: "254 E Buckeye Rd, Phoenix, AZ 85004", phone: "(602) 616-3801", website: null, category: "Mexican" },
    { name: "Desert Gold Cafe", address: "515 W Buckeye Rd, Phoenix, AZ 85003", phone: "(602) 252-2150", website: null, category: "Cafe" },
  ],
  'Central and Pioneer': [
    { name: "Comedor Guadalajara", address: "1830 S Central Ave, Phoenix, AZ 85004", phone: "602-253-8299", website: null, category: "Mexican" },
    { name: "Aryze Eatery", address: "1701 S Central Ave, Phoenix, AZ 85004", phone: "602-688-9106", website: null, category: "Restaurant" },
    { name: "EZBACHI Japanese Grill", address: "1713 S Central Ave, Phoenix, AZ 85004", phone: "602-900-6183", website: null, category: "Japanese" },
  ],
  'Broadway and Central': [
    { name: "El Nuevo Taquito", address: "4118 S Central Ave, Phoenix, AZ 85040", phone: "(602) 276-3018", website: null, category: "Mexican" },
    { name: "Taqueria Tepehuaje", address: "4602 S Central Ave, Phoenix, AZ 85040", phone: "(623) 206-4691", website: null, category: "Mexican" },
    { name: "Taqueria Y Birrieria Jalisco", address: "615 W Broadway Rd, Phoenix, AZ 85041", phone: "(602) 268-1032", website: null, category: "Mexican" },
    { name: "Tacos Rodriguez", address: "234 E Broadway Rd, Phoenix, AZ 85040", phone: null, website: null, category: "Mexican" },
  ],
  'Central and Roeser': [
    { name: "Las Glorias Mexican Seafood", address: "5220 S Central Ave, Phoenix, AZ 85040", phone: "602-268-3053", website: null, category: "Mexican Seafood" },
    { name: "Subway", address: "5217 S Central Ave, Ste B-2, Phoenix, AZ 85040", phone: "602-243-3747", website: "https://www.subway.com", category: "Sandwiches" },
    { name: "Dairy Queen (Treat)", address: "5217 S Central Ave, Phoenix, AZ 85040", phone: "602-243-3566", website: "https://www.dairyqueen.com", category: "Ice Cream" },
    { name: "NI HAO Express Chinese Cuisine / King Wong", address: "5219 S 7th St, Phoenix, AZ 85040", phone: "602-268-9397", website: null, category: "Chinese" },
    { name: "Taquería Tepehuaje", address: "4602 S Central Ave, Phoenix, AZ 85040", phone: "623-206-4691", website: null, category: "Mexican" },
    { name: "El Nuevo Taquito", address: "4118 S Central Ave, Phoenix, AZ 85040", phone: null, website: null, category: "Mexican" },
  ],
  'Central and Southern': [
    { name: "La Olmeca Restaurant", address: "6066 S Central Ave, Phoenix, AZ 85042", phone: "602-276-7531", website: null, category: "Mexican" },
    { name: "Peter Piper Pizza", address: "6040 S Central Ave, Phoenix, AZ 85040", phone: "602-243-7183", website: "https://www.peterpiperpizza.com", category: "Pizza" },
    { name: "McDonald's – Central & Southern", address: "6005 S Central Ave, Phoenix, AZ 85040", phone: "602-276-6518", website: "https://www.mcdonalds.com", category: "Fast Food" },
    { name: "Cocina Sinaloense La Vaca Lola / Mariscos El Dorado", address: "5630 S Central Ave, Phoenix, AZ 85040", phone: "602-276-4141", website: null, category: "Mexican" },
    { name: "Taquería Tepehuaje", address: "4602 S Central Ave, Phoenix, AZ 85040", phone: "623-206-4691", website: null, category: "Mexican" },
    { name: "Las Glorias Mexican Seafood", address: "5220 S Central Ave, Phoenix, AZ 85040", phone: "602-268-3053", website: null, category: "Mexican Seafood" },
    { name: "Tacos Mí Ranchito Mexican Grill", address: "6607 S Central Ave, Phoenix, AZ 85042", phone: "602-323-9000", website: null, category: "Mexican" },
    { name: "Gino's Pizza at El Museo", address: "6420 S Central Ave, Phoenix, AZ 85042", phone: "602-268-3341", website: null, category: "Pizza" },
  ],
  'Central and Baseline': [
    { name: "Church's Texas Chicken", address: "7444 S Central Ave, Phoenix, AZ 85040", phone: "(602) 276-3365", website: "https://www.churchs.com", category: "Chicken" },
    { name: "KFC", address: "20 E Baseline Rd, Phoenix, AZ 85042", phone: "(602) 243-8415", website: "https://www.kfc.com", category: "Chicken" },
    { name: "Marcia's Long Wongs", address: "5 W Baseline Rd, Phoenix, AZ 85041", phone: "(602) 276-4330", website: null, category: "Chicken" },
    { name: "El Mesquite Cocina Mexicana", address: "26 E Baseline Rd, Ste 120, Phoenix, AZ 85042", phone: "(602) 243-7107", website: null, category: "Mexican" },
    { name: "Happy Food Restaurant", address: "3 W Baseline Rd, Phoenix, AZ 85041", phone: "(602) 268-8010", website: null, category: "Chinese" },
    { name: "Poncho's Mexican Food and Cantina", address: "7202 S Central Ave, Phoenix, AZ 85042", phone: "(602) 276-2437", website: null, category: "Mexican" },
    { name: "Central BBQ House", address: "7227 S Central Ave, Phoenix, AZ 85042", phone: "(602) 368-4172", website: null, category: "BBQ" },
    { name: "Tortas Paquime", address: "7227 S Central Ave, Phoenix, AZ 85042", phone: "(602) 314-4722", website: null, category: "Mexican" },
    { name: "Hungry Howie's Pizza", address: "7227 S Central Ave, Ste 1025, Phoenix, AZ 85042", phone: "(602) 362-0505", website: "https://www.hungryhowies.com", category: "Pizza" },
    { name: "Canton Wong", address: "7050 S Central Ave, Phoenix, AZ 85042", phone: "(602) 276-5486", website: null, category: "Chinese" },
    { name: "Pizza Patrón South Central Ave", address: "7602 S Central Ave #1, Phoenix, AZ 85042", phone: null, website: null, category: "Pizza" },
  ],
};

// Geocoding function using Mapbox Geocoding API
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!config.mapboxAccessToken) {
    console.warn('Mapbox access token not configured, skipping geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${config.mapboxAccessToken}&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Geocoding failed for ${address}: ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { features?: Array<{ center: [number, number] }> };
    if (data.features && data.features.length > 0 && data.features[0]) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }

    return null;
  } catch (error) {
    console.warn(`Geocoding error for ${address}:`, error);
    return null;
  }
}

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to seed the database');
  }

  await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      let totalInserted = 0;
      let totalSkipped = 0;

      for (const [userStationName, restaurants] of Object.entries(restaurantsByStation)) {
        const dbStationName = stationMapping[userStationName];
        if (!dbStationName) {
          console.warn(`No mapping found for station: ${userStationName}, skipping ${restaurants.length} restaurants`);
          continue;
        }

        // Get the station ID from the database
        const stationResult = await client.query<{ id: string }>(
          'SELECT id FROM stops WHERE name = $1 LIMIT 1',
          [dbStationName]
        );

        if (!stationResult.rows[0]) {
          console.warn(`Station not found in database: ${dbStationName}, skipping ${restaurants.length} restaurants`);
          continue;
        }

        const stationId = stationResult.rows[0].id;

        for (const restaurant of restaurants) {
          // Check if vendor already exists
          const existingVendor = await client.query<{ id: string }>(
            'SELECT id FROM vendors WHERE name = $1 AND address = $2 LIMIT 1',
            [restaurant.name, restaurant.address]
          );

          if (existingVendor.rows[0]) {
            console.log(`Skipping existing vendor: ${restaurant.name} at ${restaurant.address}`);
            totalSkipped++;
            continue;
          }

          // Geocode the address
          const coordinates = await geocodeAddress(restaurant.address);
          const latitude = coordinates?.latitude ?? null;
          const longitude = coordinates?.longitude ?? null;

          // Extract city from address or default to Phoenix
          const cityMatch = restaurant.address.match(/,\s*([^,]+)\s+[A-Z]{2}\s*\d{5}/);
          const city = cityMatch?.[1]?.trim() || 'Phoenix';

          // Insert the vendor
          await client.query(
            `
              INSERT INTO vendors (name, address, city, category, station, phone, website, latitude, longitude, pos_type, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `,
            [
              restaurant.name,
              restaurant.address,
              city,
              restaurant.category,
              dbStationName,
              restaurant.phone,
              restaurant.website,
              latitude,
              longitude,
              'other', // Default POS type since these are imported vendors
              'approved', // Auto-approve imported vendors
            ]
          );

          console.log(`Inserted: ${restaurant.name} at ${restaurant.address} (Station: ${dbStationName})`);
          if (coordinates) {
            console.log(`  Coordinates: ${latitude}, ${longitude}`);
          } else {
            console.log(`  No coordinates found`);
          }
          totalInserted++;
        }
      }

      await client.query('COMMIT');
      console.log(`\nCompleted: ${totalInserted} vendors inserted, ${totalSkipped} skipped`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  await closePool();
}

void main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
