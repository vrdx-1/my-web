/**
 * แผนที่ categoryId -> modelNames[] จากไฟล์ใน category-models
 * สร้างจาก scripts/generate-category-models.mjs
 */

import bus from './bus.json';
import electric from './electric.json';
import hilux from './hilux.json';
import hybrid from './hybrid.json';
import luxury from './luxury.json';
import pickup from './pickup.json';
import sedan from './sedan.json';
import sport from './sport.json';
import supercar from './supercar.json';
import suv from './suv.json';
import truck from './truck.json';
import van from './van.json';

export type CategoryModelsMap = Record<string, string[]>;

export const CATEGORY_MODELS: CategoryModelsMap = {
  bus: bus.modelNames,
  electric: electric.modelNames,
  hilux: hilux.modelNames,
  hybrid: hybrid.modelNames,
  luxury: luxury.modelNames,
  pickup: pickup.modelNames,
  sedan: sedan.modelNames,
  sport: sport.modelNames,
  supercar: supercar.modelNames,
  suv: suv.modelNames,
  truck: truck.modelNames,
  van: van.modelNames,
};
