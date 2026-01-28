const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Major metros with neighborhoods - this is where we're missing shops
const NEIGHBORHOODS = [
  // NYC
  { area: 'Williamsburg, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Bushwick, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Park Slope, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Greenpoint, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Cobble Hill, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'DUMBO, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Bedford-Stuyvesant, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Crown Heights, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Prospect Heights, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Red Hook, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Fort Greene, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Clinton Hill, Brooklyn', city: 'Brooklyn', state: 'NY' },
  { area: 'Astoria, Queens', city: 'Queens', state: 'NY' },
  { area: 'Long Island City, Queens', city: 'Queens', state: 'NY' },
  { area: 'Ridgewood, Queens', city: 'Queens', state: 'NY' },
  { area: 'Jackson Heights, Queens', city: 'Queens', state: 'NY' },
  { area: 'Flushing, Queens', city: 'Queens', state: 'NY' },
  { area: 'Lower East Side, Manhattan', city: 'New York', state: 'NY' },
  { area: 'East Village, Manhattan', city: 'New York', state: 'NY' },
  { area: 'West Village, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Greenwich Village, Manhattan', city: 'New York', state: 'NY' },
  { area: 'SoHo, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Tribeca, Manhattan', city: 'New York', state: 'NY' },
  { area: 'NoHo, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Nolita, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Chinatown, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Chelsea, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Flatiron, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Gramercy, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Murray Hill, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Midtown East, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Midtown West, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Hell\'s Kitchen, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Upper West Side, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Upper East Side, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Harlem, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Washington Heights, Manhattan', city: 'New York', state: 'NY' },
  { area: 'Inwood, Manhattan', city: 'New York', state: 'NY' },
  { area: 'South Bronx', city: 'Bronx', state: 'NY' },
  { area: 'Riverdale, Bronx', city: 'Bronx', state: 'NY' },
  { area: 'St. George, Staten Island', city: 'Staten Island', state: 'NY' },
  
  // Los Angeles
  { area: 'Silver Lake, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Echo Park, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Los Feliz, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Highland Park, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Eagle Rock, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Atwater Village, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Koreatown, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Arts District, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Downtown Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Little Tokyo, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Chinatown, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Venice, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Mar Vista, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Culver City', city: 'Culver City', state: 'CA' },
  { area: 'West Hollywood', city: 'West Hollywood', state: 'CA' },
  { area: 'Beverly Grove, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Fairfax District, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Melrose, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Larchmont, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Los Angeles, Miracle Mile', city: 'Los Angeles', state: 'CA' },
  { area: 'Mid-Wilshire, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Westwood, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Brentwood, Los Angeles', city: 'Los Angeles', state: 'CA' },
  { area: 'Pacific Palisades', city: 'Los Angeles', state: 'CA' },
  { area: 'Santa Monica', city: 'Santa Monica', state: 'CA' },
  { area: 'Malibu', city: 'Malibu', state: 'CA' },
  { area: 'Manhattan Beach', city: 'Manhattan Beach', state: 'CA' },
  { area: 'Hermosa Beach', city: 'Hermosa Beach', state: 'CA' },
  { area: 'Redondo Beach', city: 'Redondo Beach', state: 'CA' },
  { area: 'El Segundo', city: 'El Segundo', state: 'CA' },
  { area: 'Playa Vista', city: 'Los Angeles', state: 'CA' },
  { area: 'Playa del Rey', city: 'Los Angeles', state: 'CA' },
  { area: 'Pasadena Old Town', city: 'Pasadena', state: 'CA' },
  { area: 'South Pasadena', city: 'South Pasadena', state: 'CA' },
  { area: 'Glendale', city: 'Glendale', state: 'CA' },
  { area: 'Burbank', city: 'Burbank', state: 'CA' },
  { area: 'Studio City', city: 'Los Angeles', state: 'CA' },
  { area: 'Sherman Oaks', city: 'Los Angeles', state: 'CA' },
  { area: 'Encino', city: 'Los Angeles', state: 'CA' },
  { area: 'Tarzana', city: 'Los Angeles', state: 'CA' },
  { area: 'Woodland Hills', city: 'Los Angeles', state: 'CA' },
  { area: 'Calabasas', city: 'Calabasas', state: 'CA' },
  
  // San Francisco Bay Area
  { area: 'Mission District, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Castro, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Hayes Valley, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Noe Valley, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Potrero Hill, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Dogpatch, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'SoMa, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Financial District, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'North Beach, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Chinatown, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Marina District, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Cow Hollow, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Pacific Heights, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Russian Hill, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Nob Hill, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Inner Sunset, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Outer Sunset, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Inner Richmond, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Outer Richmond, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Haight-Ashbury, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Cole Valley, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Glen Park, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Bernal Heights, San Francisco', city: 'San Francisco', state: 'CA' },
  { area: 'Temescal, Oakland', city: 'Oakland', state: 'CA' },
  { area: 'Rockridge, Oakland', city: 'Oakland', state: 'CA' },
  { area: 'Piedmont Avenue, Oakland', city: 'Oakland', state: 'CA' },
  { area: 'Jack London Square, Oakland', city: 'Oakland', state: 'CA' },
  { area: 'Grand Lake, Oakland', city: 'Oakland', state: 'CA' },
  { area: 'Uptown Oakland', city: 'Oakland', state: 'CA' },
  { area: 'Downtown Berkeley', city: 'Berkeley', state: 'CA' },
  { area: 'North Berkeley', city: 'Berkeley', state: 'CA' },
  { area: 'Elmwood, Berkeley', city: 'Berkeley', state: 'CA' },
  
  // Chicago
  { area: 'Wicker Park, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Bucktown, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Logan Square, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Humboldt Park, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Ukrainian Village, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'West Town, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'River North, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Streeterville, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Gold Coast, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Old Town, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Lincoln Park, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Lakeview, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Boystown, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Roscoe Village, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'North Center, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Ravenswood, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Andersonville, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Edgewater, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Rogers Park, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Uptown, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Albany Park, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Irving Park, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Avondale, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Pilsen, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Bridgeport, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Hyde Park, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'South Loop, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'West Loop, Chicago', city: 'Chicago', state: 'IL' },
  { area: 'Fulton Market, Chicago', city: 'Chicago', state: 'IL' },
  
  // Seattle
  { area: 'Capitol Hill, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Fremont, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Ballard, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Wallingford, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Green Lake, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'University District, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Roosevelt, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Ravenna, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Wedgwood, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Greenwood, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Phinney Ridge, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Queen Anne, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Magnolia, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Belltown, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Downtown Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Pioneer Square, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'International District, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'SoDo, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Georgetown, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Columbia City, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Beacon Hill, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Central District, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Madison Valley, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Madrona, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'Leschi, Seattle', city: 'Seattle', state: 'WA' },
  { area: 'West Seattle', city: 'Seattle', state: 'WA' },
  { area: 'White Center, Seattle', city: 'Seattle', state: 'WA' },
  
  // Portland
  { area: 'Pearl District, Portland', city: 'Portland', state: 'OR' },
  { area: 'Northwest Portland', city: 'Portland', state: 'OR' },
  { area: 'Nob Hill, Portland', city: 'Portland', state: 'OR' },
  { area: 'Alberta Arts District, Portland', city: 'Portland', state: 'OR' },
  { area: 'Mississippi District, Portland', city: 'Portland', state: 'OR' },
  { area: 'Williams District, Portland', city: 'Portland', state: 'OR' },
  { area: 'Hawthorne, Portland', city: 'Portland', state: 'OR' },
  { area: 'Division Street, Portland', city: 'Portland', state: 'OR' },
  { area: 'Belmont, Portland', city: 'Portland', state: 'OR' },
  { area: 'Sellwood, Portland', city: 'Portland', state: 'OR' },
  { area: 'St Johns, Portland', city: 'Portland', state: 'OR' },
  { area: 'Kenton, Portland', city: 'Portland', state: 'OR' },
  { area: 'Montavilla, Portland', city: 'Portland', state: 'OR' },
  { area: 'Foster-Powell, Portland', city: 'Portland', state: 'OR' },
  { area: 'Woodstock, Portland', city: 'Portland', state: 'OR' },
  { area: 'Hollywood District, Portland', city: 'Portland', state: 'OR' },
  { area: 'Irvington, Portland', city: 'Portland', state: 'OR' },
  { area: 'Lloyd District, Portland', city: 'Portland', state: 'OR' },
  { area: 'Downtown Portland', city: 'Portland', state: 'OR' },
  
  // Austin
  { area: 'South Congress, Austin', city: 'Austin', state: 'TX' },
  { area: 'East Austin', city: 'Austin', state: 'TX' },
  { area: 'East 6th Street, Austin', city: 'Austin', state: 'TX' },
  { area: 'Rainey Street, Austin', city: 'Austin', state: 'TX' },
  { area: 'Downtown Austin', city: 'Austin', state: 'TX' },
  { area: 'Hyde Park, Austin', city: 'Austin', state: 'TX' },
  { area: 'North Loop, Austin', city: 'Austin', state: 'TX' },
  { area: 'Mueller, Austin', city: 'Austin', state: 'TX' },
  { area: 'Domain, Austin', city: 'Austin', state: 'TX' },
  { area: 'South Lamar, Austin', city: 'Austin', state: 'TX' },
  { area: 'Zilker, Austin', city: 'Austin', state: 'TX' },
  { area: 'Barton Springs, Austin', city: 'Austin', state: 'TX' },
  { area: 'Clarksville, Austin', city: 'Austin', state: 'TX' },
  { area: 'Tarrytown, Austin', city: 'Austin', state: 'TX' },
  { area: 'West Campus, Austin', city: 'Austin', state: 'TX' },
  { area: 'UT Austin area', city: 'Austin', state: 'TX' },
  
  // Denver
  { area: 'RiNo, Denver', city: 'Denver', state: 'CO' },
  { area: 'LoHi, Denver', city: 'Denver', state: 'CO' },
  { area: 'LoDo, Denver', city: 'Denver', state: 'CO' },
  { area: 'Capitol Hill, Denver', city: 'Denver', state: 'CO' },
  { area: 'Cheesman Park, Denver', city: 'Denver', state: 'CO' },
  { area: 'City Park, Denver', city: 'Denver', state: 'CO' },
  { area: 'Highlands, Denver', city: 'Denver', state: 'CO' },
  { area: 'Sunnyside, Denver', city: 'Denver', state: 'CO' },
  { area: 'Berkeley, Denver', city: 'Denver', state: 'CO' },
  { area: 'Tennyson Street, Denver', city: 'Denver', state: 'CO' },
  { area: 'South Broadway, Denver', city: 'Denver', state: 'CO' },
  { area: 'Baker, Denver', city: 'Denver', state: 'CO' },
  { area: 'Washington Park, Denver', city: 'Denver', state: 'CO' },
  { area: 'Cherry Creek, Denver', city: 'Denver', state: 'CO' },
  { area: 'Platt Park, Denver', city: 'Denver', state: 'CO' },
  { area: 'Congress Park, Denver', city: 'Denver', state: 'CO' },
  
  // Boston
  { area: 'Back Bay, Boston', city: 'Boston', state: 'MA' },
  { area: 'South End, Boston', city: 'Boston', state: 'MA' },
  { area: 'Beacon Hill, Boston', city: 'Boston', state: 'MA' },
  { area: 'North End, Boston', city: 'Boston', state: 'MA' },
  { area: 'Seaport District, Boston', city: 'Boston', state: 'MA' },
  { area: 'Downtown Boston', city: 'Boston', state: 'MA' },
  { area: 'Financial District, Boston', city: 'Boston', state: 'MA' },
  { area: 'Fenway, Boston', city: 'Boston', state: 'MA' },
  { area: 'Jamaica Plain, Boston', city: 'Boston', state: 'MA' },
  { area: 'Brookline', city: 'Brookline', state: 'MA' },
  { area: 'Coolidge Corner, Brookline', city: 'Brookline', state: 'MA' },
  { area: 'Cambridge', city: 'Cambridge', state: 'MA' },
  { area: 'Harvard Square, Cambridge', city: 'Cambridge', state: 'MA' },
  { area: 'Central Square, Cambridge', city: 'Cambridge', state: 'MA' },
  { area: 'Kendall Square, Cambridge', city: 'Cambridge', state: 'MA' },
  { area: 'Porter Square, Cambridge', city: 'Cambridge', state: 'MA' },
  { area: 'Inman Square, Cambridge', city: 'Cambridge', state: 'MA' },
  { area: 'Somerville', city: 'Somerville', state: 'MA' },
  { area: 'Davis Square, Somerville', city: 'Somerville', state: 'MA' },
  { area: 'Union Square, Somerville', city: 'Somerville', state: 'MA' },
  
  // Philadelphia
  { area: 'Rittenhouse Square, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Center City, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Old City, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Northern Liberties, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Fishtown, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Kensington, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Queen Village, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Passyunk, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Graduate Hospital, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'University City, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Manayunk, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Chestnut Hill, Philadelphia', city: 'Philadelphia', state: 'PA' },
  { area: 'Mt Airy, Philadelphia', city: 'Philadelphia', state: 'PA' },
  
  // DC
  { area: 'Georgetown, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Dupont Circle, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Adams Morgan, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'U Street, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Shaw, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Logan Circle, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Capitol Hill, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Eastern Market, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'H Street, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Navy Yard, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Penn Quarter, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Chinatown, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Columbia Heights, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Petworth, Washington DC', city: 'Washington', state: 'DC' },
  { area: 'Brookland, Washington DC', city: 'Washington', state: 'DC' },
  { area: '14th Street, Washington DC', city: 'Washington', state: 'DC' },
  
  // Miami
  { area: 'Wynwood, Miami', city: 'Miami', state: 'FL' },
  { area: 'Design District, Miami', city: 'Miami', state: 'FL' },
  { area: 'Brickell, Miami', city: 'Miami', state: 'FL' },
  { area: 'Downtown Miami', city: 'Miami', state: 'FL' },
  { area: 'Little Havana, Miami', city: 'Miami', state: 'FL' },
  { area: 'Coconut Grove, Miami', city: 'Miami', state: 'FL' },
  { area: 'Coral Gables', city: 'Coral Gables', state: 'FL' },
  { area: 'South Beach, Miami Beach', city: 'Miami Beach', state: 'FL' },
  { area: 'North Beach, Miami Beach', city: 'Miami Beach', state: 'FL' },
  { area: 'Mid-Beach, Miami Beach', city: 'Miami Beach', state: 'FL' },
  
  // Atlanta
  { area: 'Midtown Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'Inman Park, Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'Little Five Points, Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'Virginia-Highland, Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'Poncey-Highland, Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'Old Fourth Ward, Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'East Atlanta Village', city: 'Atlanta', state: 'GA' },
  { area: 'Grant Park, Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'Decatur', city: 'Decatur', state: 'GA' },
  { area: 'Westside Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'West Midtown, Atlanta', city: 'Atlanta', state: 'GA' },
  { area: 'Buckhead, Atlanta', city: 'Atlanta', state: 'GA' },
  
  // Nashville
  { area: 'East Nashville', city: 'Nashville', state: 'TN' },
  { area: '12 South, Nashville', city: 'Nashville', state: 'TN' },
  { area: 'The Gulch, Nashville', city: 'Nashville', state: 'TN' },
  { area: 'Germantown, Nashville', city: 'Nashville', state: 'TN' },
  { area: 'Marathon Village, Nashville', city: 'Nashville', state: 'TN' },
  { area: 'Hillsboro Village, Nashville', city: 'Nashville', state: 'TN' },
  { area: 'Berry Hill, Nashville', city: 'Nashville', state: 'TN' },
  { area: 'Wedgewood-Houston, Nashville', city: 'Nashville', state: 'TN' },
  { area: 'Downtown Nashville', city: 'Nashville', state: 'TN' },
  { area: 'Sylvan Park, Nashville', city: 'Nashville', state: 'TN' },
  
  // Minneapolis
  { area: 'North Loop, Minneapolis', city: 'Minneapolis', state: 'MN' },
  { area: 'Northeast Minneapolis', city: 'Minneapolis', state: 'MN' },
  { area: 'Uptown, Minneapolis', city: 'Minneapolis', state: 'MN' },
  { area: 'Lyn-Lake, Minneapolis', city: 'Minneapolis', state: 'MN' },
  { area: 'Loring Park, Minneapolis', city: 'Minneapolis', state: 'MN' },
  { area: 'Downtown Minneapolis', city: 'Minneapolis', state: 'MN' },
  { area: 'Dinkytown, Minneapolis', city: 'Minneapolis', state: 'MN' },
  { area: 'St Paul', city: 'St Paul', state: 'MN' },
  { area: 'Grand Avenue, St Paul', city: 'St Paul', state: 'MN' },
  { area: 'Cathedral Hill, St Paul', city: 'St Paul', state: 'MN' },
];

let stats = { processed: 0, added: 0, skipped: 0, errors: 0 };
let processedAreas = new Set();

async function loadProgress() {
  try {
    const fs = require('fs');
    if (fs.existsSync('neighborhoods-progress.json')) {
      const data = JSON.parse(fs.readFileSync('neighborhoods-progress.json'));
      processedAreas = new Set(data.processedAreas || []);
      console.log(`Resuming from ${processedAreas.size} processed neighborhoods`);
    }
  } catch (e) {}
}

function saveProgress() {
  const fs = require('fs');
  fs.writeFileSync('neighborhoods-progress.json', JSON.stringify({ processedAreas: [...processedAreas], stats }));
}

async function searchNeighborhood(area, city, state) {
  const query = `coffee shops in ${area}`;
  const url = `https://places.googleapis.com/v1/places:searchText`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus'
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20 })
  });
  
  const data = await response.json();
  return data.places || [];
}

async function processNeighborhood(area, city, state) {
  if (processedAreas.has(area)) return;
  
  try {
    const places = await searchNeighborhood(area, city, state);
    let added = 0;
    
    for (const place of places) {
      if (place.businessStatus !== 'OPERATIONAL') continue;
      
      // Check if exists by google_place_id
      const { data: existing } = await db.from('shops')
        .select('id')
        .eq('google_place_id', place.id)
        .maybeSingle();
      
      if (existing) {
        stats.skipped++;
        continue;
      }
      
      // Extract city from address
      const addressParts = (place.formattedAddress || '').split(',');
      const extractedCity = addressParts.length >= 3 ? addressParts[addressParts.length - 3]?.trim() : city;
      const extractedState = addressParts.length >= 2 ? addressParts[addressParts.length - 2]?.trim().split(' ')[0] : state;
      
      const shopData = {
        name: place.displayName?.text,
        google_place_id: place.id,
        address: place.formattedAddress,
        city: extractedCity || city,
        state: extractedState || state,
        state_code: extractedState || state,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        google_rating: place.rating,
        google_reviews: place.userRatingCount,
        source: 'enriched',
        is_active: true,
        lead_score: 50
      };
      
      if (shopData.name) {
        await db.from('shops').insert(shopData);
        added++;
      }
    }
    
    stats.processed++;
    stats.added += added;
    processedAreas.add(area);
    
    if (added > 0) {
      console.log(`✓ ${area}: +${added} new (${stats.processed}/${NEIGHBORHOODS.length})`);
    } else {
      console.log(`· ${area}: complete (${stats.processed}/${NEIGHBORHOODS.length})`);
    }
    
    if (stats.processed % 20 === 0) saveProgress();
    
  } catch (err) {
    console.error(`✗ ${area}: ${err.message}`);
    stats.errors++;
  }
  
  await new Promise(r => setTimeout(r, 150));
}

async function main() {
  console.log('🏘️ Neighborhood-Level Enrichment');
  console.log(`Processing ${NEIGHBORHOODS.length} neighborhoods in major metros...\n`);
  
  await loadProgress();
  
  for (const { area, city, state } of NEIGHBORHOODS) {
    await processNeighborhood(area, city, state);
  }
  
  saveProgress();
  
  console.log('\n==================================================');
  console.log('📊 FINAL RESULTS');
  console.log('==================================================');
  console.log(`Neighborhoods: ${stats.processed}`);
  console.log(`New Shops: ${stats.added}`);
  console.log(`Already Had: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
}

main().catch(console.error);
