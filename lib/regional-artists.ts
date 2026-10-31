import type { Artist } from "./types";

/** Searchable starting points for the music communities Sangeet serves first. */
const nepaliHindiNames = [
  ["sajjan-raj-vaidya", "Sajjan Raj Vaidya", "Nepali singer-songwriter", "Nepali", "indie"],
  ["sushant-kc", "Sushant KC", "Nepali pop artist", "Nepali", "pop"],
  ["bartika-rai", "Bartika Eam Rai", "Nepali singer-songwriter", "Nepali", "indie"],
  ["bipul-chettri", "Bipul Chettri", "Nepali folk singer-songwriter", "Nepali", "indie"],
  ["yabesh-thapa", "Yabesh Thapa", "Nepali pop artist", "Nepali", "pop"],
  ["neetesh-jung-kunwar", "Neetesh Jung Kunwar", "Nepali singer-songwriter", "Nepali", "alternative"],
  ["laure", "Laure", "Nepali hip-hop artist", "Nepali", "hiphop"],
  ["tribal-rain", "Tribal Rain", "Nepali rock band", "Nepali", "alternative"],
  ["albatross", "Albatross", "Nepali rock band", "Nepali", "alternative"],
  ["1974-ad", "1974 AD", "Nepali rock band", "Nepali", "alternative"],
  ["the-edge-band", "The Edge Band", "Nepali rock band", "Nepali", "alternative"],
  ["kuma-sagar", "Kuma Sagar", "Nepali folk and pop artist", "Nepali", "indie"],
  ["arijit-singh", "Arijit Singh", "Hindi playback singer", "Hindi", "pop"],
  ["shreya-ghoshal", "Shreya Ghoshal", "Hindi playback singer", "Hindi", "pop"],
  ["ar-rahman", "A. R. Rahman", "Indian composer and producer", "Hindi", "cinematic"],
  ["sonu-nigam", "Sonu Nigam", "Indian playback singer", "Hindi", "pop"],
  ["kk", "KK", "Indian playback singer", "Hindi", "pop"],
  ["lata-mangeshkar", "Lata Mangeshkar", "Indian playback singer", "Hindi", "pop"],
  ["kishore-kumar", "Kishore Kumar", "Indian playback singer", "Hindi", "pop"],
  ["diljit-dosanjh", "Diljit Dosanjh", "Punjabi singer and performer", "Punjabi", "pop"],
  ["pritam", "Pritam", "Indian composer and producer", "Hindi", "cinematic"],
  ["anuv-jain", "Anuv Jain", "Indian singer-songwriter", "Hindi", "indie"],
  ["jubin-nautiyal", "Jubin Nautiyal", "Indian playback singer", "Hindi", "pop"],
  ["sunidhi-chauhan", "Sunidhi Chauhan", "Indian playback singer", "Hindi", "pop"],
  ["badshah", "Badshah", "Indian hip-hop artist", "Hindi", "hiphop"],
  ["vishal-mishra", "Vishal Mishra", "Indian singer-songwriter and composer", "Hindi", "pop"],
] as const;

export const regionalArtists: Artist[] = nepaliHindiNames.map(([id, name, shortBio, language, genre]) => ({
  id,
  name,
  bio: `${name} is part of Sangeet’s ${language} music discovery collection. Explore songs, save favorites, and get recommendations after choosing this artist.`,
  shortBio,
  image: `/art/artists/regional/${id}.svg`,
  location: language,
  genreIds: [genre],
  relatedArtistIds: [],
  languages: [language],
  aliases: name === "A. R. Rahman" ? ["AR Rahman", "Allah Rakha Rahman"] : name === "Bartika Eam Rai" ? ["Bartika Rai"] : [],
}));
