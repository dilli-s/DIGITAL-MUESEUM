import fs from 'fs';
import { museums } from './src/data/museums.js';
import { galleries } from './src/data/galleries.js';
import { collections } from './src/data/collections.js';
import { exhibitions } from './src/data/exhibitions.js';
import { objects } from './src/data/objects.js';

const data = {
  museums,
  galleries,
  collections,
  exhibitions,
  objects
};

fs.writeFileSync('../backend/seed_data.json', JSON.stringify(data, null, 2));
