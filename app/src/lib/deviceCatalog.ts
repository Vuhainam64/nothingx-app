import { getDeviceCapabilities } from './deviceCapabilities';

export interface DeviceColorVariant {
  sku: string;
  colorName: string;
  hex: string;
  heroImage: string;
  leftImage: string;
  rightImage: string;
  caseImage: string;
  steerImage: string;
}

export type DeviceFormFactor = 'tws' | 'headphone' | 'neckband';

export interface DeviceCatalogEntry {
  modelId: string;
  name: string;
  brand: 'Nothing' | 'CMF';
  formFactor: DeviceFormFactor;
  releaseYear: number;
  colors: DeviceColorVariant[];
  // Legacy flags kept for backward compatibility. They are DERIVED from getDeviceCapabilities(modelId, null)
  // at module init — new code should use capabilities (useCapabilities()) instead.
  supportsPersonalAnc: boolean;
  supportsParametricEq: boolean;
  supportsDiracOpteo: boolean;
  supportsUltraBass: boolean;
  supportsSpatialAudio: boolean;
  supportsDualConnection: boolean;
  supportsSmartDial: boolean;
  highResCodec?: 'LDAC' | 'LHDC 5.0';
}

const CATALOG_BASE: CatalogBase[] = [
  {
    modelId: 'B170',
    name: 'Nothing Headphone (1)',
    brand: 'Nothing',
    formFactor: 'headphone',
    releaseYear: 2025,
    colors: [
      {
        sku: 'B170_09',
        colorName: 'Silver',
        hex: '#E5E7EB',
        heroImage: '/assets/devices/sku/B170_09_global.png',
        leftImage: '/assets/devices/sku/B170_09_left.png',
        rightImage: '/assets/devices/sku/B170_09_right.png',
        caseImage: '/assets/devices/sku/B170_09_case.png',
        steerImage: '/assets/devices/sku/B170_09_steer.png',
      },
      {
        sku: 'B170_01',
        colorName: 'Black',
        hex: '#1F2328',
        heroImage: '/assets/devices/sku/B170_01_global.png',
        leftImage: '/assets/devices/sku/B170_01_left.png',
        rightImage: '/assets/devices/sku/B170_01_right.png',
        caseImage: '/assets/devices/sku/B170_01_case.png',
        steerImage: '/assets/devices/sku/B170_01_steer.png',
      },
    ],
  },
  {
    modelId: 'B171',
    name: 'Nothing Ear',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2024,
    colors: [
      {
        sku: 'B171_01',
        colorName: 'Black',
        hex: '#1F2328',
        heroImage: '/assets/devices/sku/B171_01_global.png',
        leftImage: '/assets/devices/ear_twos_black_left.png',
        rightImage: '/assets/devices/ear_twos_black_right.png',
        caseImage: '/assets/devices/ear_twos_help_case.png',
        steerImage: '/assets/devices/sku/B171_01_steer.png',
      },
      {
        sku: 'B171_02',
        colorName: 'White',
        hex: '#F3F4F6',
        heroImage: '/assets/devices/os_ear_twos_white_disconnect.png',
        leftImage: '/assets/devices/ear_twos_white_left.png',
        rightImage: '/assets/devices/ear_twos_white_right.png',
        caseImage: '/assets/devices/ear_twos_help_case.png',
        steerImage: '/assets/devices/sku/B171_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B162',
    name: 'Nothing Ear (a)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2024,
    colors: [
      {
        sku: 'B162_08',
        colorName: 'Yellow',
        hex: '#FACC15',
        heroImage: '/assets/devices/sku/B162_08_global.png',
        leftImage: '/assets/devices/ear_color_yellow_left.png',
        rightImage: '/assets/devices/ear_color_yellow_right.png',
        caseImage: '/assets/devices/sku/B162_08_case.png',
        steerImage: '/assets/devices/sku/B162_08_steer.png',
      },
      {
        sku: 'B162_01',
        colorName: 'Black',
        hex: '#1F2328',
        heroImage: '/assets/devices/sku/B162_01_global.png',
        leftImage: '/assets/devices/ear_color_black_left.png',
        rightImage: '/assets/devices/ear_color_black_right.png',
        caseImage: '/assets/devices/sku/B162_01_case.png',
        steerImage: '/assets/devices/sku/B162_01_steer.png',
      },
      {
        sku: 'B162_02',
        colorName: 'White',
        hex: '#F3F4F6',
        heroImage: '/assets/devices/sku/B162_02_global.png',
        leftImage: '/assets/devices/ear_color_white_left.png',
        rightImage: '/assets/devices/ear_color_white_right.png',
        caseImage: '/assets/devices/sku/B162_02_case.png',
        steerImage: '/assets/devices/sku/B162_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B174',
    name: 'Nothing Ear (open)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2024,
    colors: [
      {
        sku: 'B174_02',
        colorName: 'White',
        hex: '#F3F4F6',
        heroImage: '/assets/devices/sku/B174_02_global.png',
        leftImage: '/assets/devices/flaffy_white_left.png',
        rightImage: '/assets/devices/flaffy_white_right.png',
        caseImage: '/assets/devices/flaffy_case.png',
        steerImage: '/assets/devices/sku/B174_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B155',
    name: 'Nothing Ear (2)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2023,
    colors: [
      {
        sku: 'B155_02',
        colorName: 'White',
        hex: '#F3F4F6',
        heroImage: '/assets/devices/sku/B155_02_global.png',
        leftImage: '/assets/devices/ear_two_left.png',
        rightImage: '/assets/devices/ear_two_right.png',
        caseImage: '/assets/devices/ear_two_case.png',
        steerImage: '/assets/devices/sku/B155_02_steer.png',
      },
      {
        sku: 'B155_01',
        colorName: 'Black',
        hex: '#1F2328',
        heroImage: '/assets/devices/sku/B155_01_global.png',
        leftImage: '/assets/devices/ear_two_black_left.png',
        rightImage: '/assets/devices/ear_two_black_right.png',
        caseImage: '/assets/devices/ear_two_case.png',
        steerImage: '/assets/devices/sku/B155_01_steer.png',
      },
    ],
  },
  {
    modelId: 'B181',
    name: 'Nothing Ear (1)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2021,
    colors: [
      {
        sku: 'B181_02',
        colorName: 'White',
        hex: '#F3F4F6',
        heroImage: '/assets/devices/sku/B181_02_global.png',
        leftImage: '/assets/devices/ear_one_white_left.png',
        rightImage: '/assets/devices/ear_one_white_right.png',
        caseImage: '/assets/devices/ear_one_case_light.png',
        steerImage: '/assets/devices/sku/B181_02_steer.png',
      },
      {
        sku: 'B181_01',
        colorName: 'Black',
        hex: '#1F2328',
        heroImage: '/assets/devices/sku/B181_01_global.png',
        leftImage: '/assets/devices/ear_one_black_left.png',
        rightImage: '/assets/devices/ear_one_black_right.png',
        caseImage: '/assets/devices/ear_one_case_dark.png',
        steerImage: '/assets/devices/sku/B181_01_steer.png',
      },
    ],
  },
  {
    modelId: 'B157',
    name: 'Nothing Ear (stick)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2022,
    colors: [
      {
        sku: 'B157_02',
        colorName: 'White',
        hex: '#F3F4F6',
        heroImage: '/assets/devices/sku/B157_02_global.png',
        leftImage: '/assets/devices/ear_stick_left.png',
        rightImage: '/assets/devices/ear_stick_right.png',
        caseImage: '/assets/devices/ear_stick_case_json.png',
        steerImage: '/assets/devices/sku/B157_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B172',
    name: 'CMF Buds Pro 2',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2024,
    colors: [
      {
        sku: 'B172_07',
        colorName: 'Orange',
        hex: '#FF5722',
        heroImage: '/assets/devices/sku/B172_07_global.png',
        leftImage: '/assets/devices/espeon_orange_left.png',
        rightImage: '/assets/devices/espeon_orange_right.png',
        caseImage: '/assets/devices/os_espeon_orange_case.png',
        steerImage: '/assets/devices/sku/B172_07_steer.png',
      },
      {
        sku: 'B172_01',
        colorName: 'Dark Grey',
        hex: '#2C3038',
        heroImage: '/assets/devices/sku/B172_01_global.png',
        leftImage: '/assets/devices/espeon_black_left.png',
        rightImage: '/assets/devices/espeon_black_right.png',
        caseImage: '/assets/devices/os_espeon_black_case.png',
        steerImage: '/assets/devices/sku/B172_01_steer.png',
      },
      {
        sku: 'B172_03',
        colorName: 'Blue',
        hex: '#2563EB',
        heroImage: '/assets/devices/sku/B172_03_global.png',
        leftImage: '/assets/devices/espeon_blue_left.png',
        rightImage: '/assets/devices/espeon_blue_right.png',
        caseImage: '/assets/devices/os_espeon_blue_case.png',
        steerImage: '/assets/devices/sku/B172_03_steer.png',
      },
      {
        sku: 'B172_02',
        colorName: 'Light Grey',
        hex: '#E5E7EB',
        heroImage: '/assets/devices/sku/B172_02_global.png',
        leftImage: '/assets/devices/espeon_white_left.png',
        rightImage: '/assets/devices/espeon_white_right.png',
        caseImage: '/assets/devices/os_espeon_white_case.png',
        steerImage: '/assets/devices/sku/B172_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B184',
    name: 'CMF Buds 2 Plus',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2025,
    colors: [
      {
        sku: 'B184_03',
        colorName: 'Blue',
        hex: '#3B82F6',
        heroImage: '/assets/devices/sku/B184_03_global.png',
        leftImage: '/assets/devices/sku/B184_03_left.png',
        rightImage: '/assets/devices/sku/B184_03_right.png',
        caseImage: '/assets/devices/sku/B184_03_case.png',
        steerImage: '/assets/devices/sku/B184_03_steer.png',
      },
      {
        sku: 'B184_02',
        colorName: 'Light Grey',
        hex: '#E5E7EB',
        heroImage: '/assets/devices/sku/B184_02_global.png',
        leftImage: '/assets/devices/sku/B184_02_left.png',
        rightImage: '/assets/devices/sku/B184_02_right.png',
        caseImage: '/assets/devices/sku/B184_02_case.png',
        steerImage: '/assets/devices/sku/B184_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B168',
    name: 'CMF Buds',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2024,
    colors: [
      {
        sku: 'B168_07',
        colorName: 'Orange',
        hex: '#FF5722',
        heroImage: '/assets/devices/sku/B168_07_global.png',
        leftImage: '/assets/devices/ear_corsola_orange_left.png',
        rightImage: '/assets/devices/ear_corsola_orange_right.png',
        caseImage: '/assets/devices/ear_corsola_help_case.png',
        steerImage: '/assets/devices/sku/B168_07_steer.png',
      },
      {
        sku: 'B168_01',
        colorName: 'Dark Grey',
        hex: '#2C3038',
        heroImage: '/assets/devices/sku/B168_01_global.png',
        leftImage: '/assets/devices/ear_corsola_black_left.png',
        rightImage: '/assets/devices/ear_corsola_black_right.png',
        caseImage: '/assets/devices/ear_corsola_help_case.png',
        steerImage: '/assets/devices/sku/B168_01_steer.png',
      },
      {
        sku: 'B168_02',
        colorName: 'Light Grey',
        hex: '#E5E7EB',
        heroImage: '/assets/devices/sku/B168_02_global.png',
        leftImage: '/assets/devices/ear_corsola_white_left.png',
        rightImage: '/assets/devices/ear_corsola_white_right.png',
        caseImage: '/assets/devices/ear_corsola_help_case.png',
        steerImage: '/assets/devices/sku/B168_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B163',
    name: 'CMF Buds Pro',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2023,
    colors: [
      {
        sku: 'B163_07',
        colorName: 'Orange',
        hex: '#FF5722',
        heroImage: '/assets/devices/sku/B163_07_global.png',
        leftImage: '/assets/devices/donphan_orange_left.png',
        rightImage: '/assets/devices/donphan_orange_right.png',
        caseImage: '/assets/devices/sku/B163_07_case.png',
        steerImage: '/assets/devices/sku/B163_07_steer.png',
      },
      {
        sku: 'B163_01',
        colorName: 'Dark Grey',
        hex: '#2C3038',
        heroImage: '/assets/devices/sku/B163_01_global.png',
        leftImage: '/assets/devices/donphan_black_left.png',
        rightImage: '/assets/devices/donphan_black_right.png',
        caseImage: '/assets/devices/sku/B163_01_case.png',
        steerImage: '/assets/devices/sku/B163_01_steer.png',
      },
      {
        sku: 'B163_02',
        colorName: 'Light Grey',
        hex: '#E5E7EB',
        heroImage: '/assets/devices/sku/B163_02_global.png',
        leftImage: '/assets/devices/donphan_white_left.png',
        rightImage: '/assets/devices/donphan_white_right.png',
        caseImage: '/assets/devices/sku/B163_02_case.png',
        steerImage: '/assets/devices/sku/B163_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B164',
    name: 'CMF Neckband Pro',
    brand: 'CMF',
    formFactor: 'neckband',
    releaseYear: 2024,
    colors: [
      {
        sku: 'B164_07',
        colorName: 'Orange',
        hex: '#FF5722',
        heroImage: '/assets/devices/sku/B164_07_global.png',
        leftImage: '/assets/devices/sku/B164_07_left.png',
        rightImage: '/assets/devices/sku/B164_07_right.png',
        caseImage: '/assets/devices/sku/B164_07_case.png',
        steerImage: '/assets/devices/sku/B164_07_steer.png',
      },
      {
        sku: 'B164_01',
        colorName: 'Dark Grey',
        hex: '#2C3038',
        heroImage: '/assets/devices/forretress_dark_grey.png',
        leftImage: '/assets/devices/forretress_dark_grey.png',
        rightImage: '/assets/devices/forretress_dark_grey.png',
        caseImage: '/assets/devices/forretress_dark_grey.png',
        steerImage: '/assets/devices/sku/B164_01_steer.png',
      },
      {
        sku: 'B164_02',
        colorName: 'Light Grey',
        hex: '#E5E7EB',
        heroImage: '/assets/devices/forretress_light_grey.png',
        leftImage: '/assets/devices/forretress_light_grey.png',
        rightImage: '/assets/devices/forretress_light_grey.png',
        caseImage: '/assets/devices/forretress_light_grey.png',
        steerImage: '/assets/devices/sku/B164_02_steer.png',
      },
    ],
  },
  {
    modelId: 'B175',
    name: 'CMF Headphone Pro',
    brand: 'CMF',
    formFactor: 'headphone',
    releaseYear: 2025,
    colors: [
      {
        sku: 'B175_01',
        colorName: 'Dark Grey',
        hex: '#2C3038',
        heroImage: '/assets/devices/sku/B175_01_global.png',
        leftImage: '/assets/devices/sku/B175_01_left.png',
        rightImage: '/assets/devices/sku/B175_01_right.png',
        caseImage: '/assets/devices/sku/B175_01_case.png',
        steerImage: '/assets/devices/sku/B175_01_steer.png',
      },
      {
        sku: 'B175_02',
        colorName: 'Light Grey',
        hex: '#E5E7EB',
        heroImage: '/assets/devices/sku/B175_02_global.png',
        leftImage: '/assets/devices/sku/B175_02_left.png',
        rightImage: '/assets/devices/sku/B175_02_right.png',
        caseImage: '/assets/devices/sku/B175_02_case.png',
        steerImage: '/assets/devices/sku/B175_02_steer.png',
      },
      {
        sku: 'B175_06',
        colorName: 'Green',
        hex: '#10B981',
        heroImage: '/assets/devices/sku/B175_06_global.png',
        leftImage: '/assets/devices/sku/B175_06_left.png',
        rightImage: '/assets/devices/sku/B175_06_right.png',
        caseImage: '/assets/devices/sku/B175_06_case.png',
        steerImage: '/assets/devices/sku/B175_06_steer.png',
      },
    ],
  },
  // ── Models added in v1.0.1 (ear_white_list.json + devices_info_list.json). Images are local files only;
  //    where a SKU has no bundled art, the closest existing model's art is reused (see comments).
  {
    modelId: 'B173',
    name: 'Nothing Ear (3)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2025,
    colors: [
      // No case/steer art in sku/ → the app's "ear_three" case art and the hero image.
      {
        sku: 'B173_01',
        colorName: 'Black',
        hex: '#1F2328',
        heroImage: '/assets/devices/sku/B173_01_global.png',
        leftImage: '/assets/devices/sku/B173_01_left.png',
        rightImage: '/assets/devices/sku/B173_01_right.png',
        caseImage: '/assets/devices/os_ear_three_black_case.png',
        steerImage: '/assets/devices/sku/B173_01_global.png',
      },
      {
        sku: 'B173_02',
        colorName: 'White',
        hex: '#F3F4F6',
        heroImage: '/assets/devices/sku/B173_02_global.png',
        leftImage: '/assets/devices/sku/B173_02_left.png',
        rightImage: '/assets/devices/sku/B173_02_right.png',
        caseImage: '/assets/devices/os_ear_three_white_case.png',
        steerImage: '/assets/devices/sku/B173_02_global.png',
      },
    ],
  },
  {
    modelId: 'B183',
    name: 'Nothing Ear (a)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2025,
    colors: [
      skuColor('B183', '08', 'Yellow', '#FACC15'),
      skuColor('B183', '01', 'Black', '#1F2328'),
      skuColor('B183', '02', 'White', '#F3F4F6'),
    ],
  },
  {
    modelId: 'B190',
    name: 'Nothing Ear (3a)',
    brand: 'Nothing',
    formFactor: 'tws',
    releaseYear: 2026,
    // No bundled art → reuses Ear (a) (B183) art; pink reuses white.
    colors: [
      skuColor('B183', '01', 'Black', '#1F2328', 'B190_01'),
      skuColor('B183', '02', 'White', '#F3F4F6', 'B190_02'),
      skuColor('B183', '08', 'Yellow', '#FACC15', 'B190_08'),
      skuColor('B183', '02', 'Pink', '#F4A7B9', 'B190_10'),
    ],
  },
  {
    modelId: 'B186',
    name: 'Nothing Headphone (a)',
    brand: 'Nothing',
    formFactor: 'headphone',
    releaseYear: 2026,
    // No SKU art → the app's "elekid" (Headphone (a) codename) renders; yellow/pink reuse white.
    colors: [
      singleImageColor('B186_01', 'Black', '#1F2328', '/assets/devices/elekid_black_global.png'),
      singleImageColor('B186_02', 'White', '#F3F4F6', '/assets/devices/elekid_white_global.png'),
      singleImageColor('B186_08', 'Yellow', '#FACC15', '/assets/devices/elekid_white_global.png'),
      singleImageColor('B186_10', 'Pink', '#F4A7B9', '/assets/devices/elekid_white_global.png'),
    ],
  },
  {
    modelId: 'B198',
    name: 'Nothing Headphone (a)',
    brand: 'Nothing',
    formFactor: 'headphone',
    releaseYear: 2026,
    colors: [
      singleImageColor('B198_01', 'Black', '#1F2328', '/assets/devices/elekid_black_global.png'),
      singleImageColor('B198_02', 'White', '#F3F4F6', '/assets/devices/elekid_white_global.png'),
      singleImageColor('B198_08', 'Yellow', '#FACC15', '/assets/devices/elekid_white_global.png'),
      singleImageColor('B198_10', 'Pink', '#F4A7B9', '/assets/devices/elekid_white_global.png'),
    ],
  },
  {
    modelId: 'B192',
    name: 'Nothing Headphone (1) Pro',
    brand: 'Nothing',
    formFactor: 'headphone',
    releaseYear: 2026,
    // No bundled art → reuses Headphone (1) (B170) art.
    colors: [
      skuColor('B170', '01', 'Black', '#1F2328', 'B192_01'),
      skuColor('B170', '09', 'Silver', '#E5E7EB', 'B192_02'),
    ],
  },
  {
    modelId: 'B179',
    name: 'CMF Buds 2',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2025,
    colors: [
      skuColor('B179', '07', 'Orange', '#FF5722'),
      skuColor('B179', '01', 'Dark Grey', '#2C3038'),
      skuColor('B179', '06', 'Light Green', '#A3C9A8'),
    ],
  },
  {
    modelId: 'B185',
    name: 'CMF Buds 2a',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2025,
    // No global art in sku/ → the app's "hoothoot" (Buds 2a) buds render as hero.
    colors: [
      { ...skuColor('B185', '07', 'Orange', '#FF5722'), heroImage: '/assets/devices/hoothoot_orange_disconnect.png' },
      { ...skuColor('B185', '01', 'Dark Grey', '#2C3038'), heroImage: '/assets/devices/hoothoot_black_disconnect.png' },
      { ...skuColor('B185', '02', 'Light Grey', '#E5E7EB'), heroImage: '/assets/devices/hoothoot_white_disconnect.png' },
    ],
  },
  {
    modelId: 'B187',
    name: 'CMF Buds Pro 2',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2025,
    colors: [
      skuColor('B187', '07', 'Orange', '#FF5722'),
      skuColor('B187', '01', 'Dark Grey', '#2C3038'),
      skuColor('B187', '03', 'Blue', '#2563EB'),
      skuColor('B187', '02', 'Light Grey', '#E5E7EB'),
    ],
  },
  {
    modelId: 'B193',
    name: 'CMF Buds Neo',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2026,
    // No bundled art → reuses CMF Buds (B168) art; blue reuses CMF Buds Pro 2 (B172) blue.
    colors: [
      skuColor('B168', '01', 'Dark Grey', '#2C3038', 'B193_01'),
      skuColor('B168', '07', 'Orange', '#FF5722', 'B193_02'),
      skuColor('B172', '03', 'Blue', '#2563EB', 'B193_03'),
    ],
  },
  {
    modelId: 'B189',
    name: 'CMF Clip Pro',
    brand: 'CMF',
    formFactor: 'tws',
    releaseYear: 2026,
    // No bundled art → reuses the open-ear Ear (open) (B174) art for every colour.
    colors: [
      skuColor('B174', '02', 'Dark Grey', '#2C3038', 'B189_01'),
      skuColor('B174', '02', 'Light Grey', '#E5E7EB', 'B189_02'),
      skuColor('B174', '02', 'Blue', '#2563EB', 'B189_03'),
      skuColor('B174', '02', 'Orange', '#FF5722', 'B189_07'),
    ],
  },
];

/** Fields that are derived from the per-model config rather than written by hand. */
type DerivedField =
  | 'supportsPersonalAnc'
  | 'supportsParametricEq'
  | 'supportsDiracOpteo'
  | 'supportsUltraBass'
  | 'supportsSpatialAudio'
  | 'supportsDualConnection'
  | 'supportsSmartDial'
  | 'highResCodec';
type CatalogBase = Omit<DeviceCatalogEntry, DerivedField>;

function skuColor(
  artModel: string,
  colorId: string,
  colorName: string,
  hex: string,
  sku = `${artModel}_${colorId}`,
): DeviceColorVariant {
  const base = `/assets/devices/sku/${artModel}_${colorId}`;
  return {
    sku,
    colorName,
    hex,
    heroImage: `${base}_global.png`,
    leftImage: `${base}_left.png`,
    rightImage: `${base}_right.png`,
    caseImage: `${base}_case.png`,
    steerImage: `${base}_steer.png`,
  };
}

function singleImageColor(sku: string, colorName: string, hex: string, image: string): DeviceColorVariant {
  return {
    sku,
    colorName,
    hex,
    heroImage: image,
    leftImage: image,
    rightImage: image,
    caseImage: image,
    steerImage: image,
  };
}

function withDerivedFlags(entry: CatalogBase): DeviceCatalogEntry {
  const caps = getDeviceCapabilities(entry.modelId, null);
  const highResCodec: DeviceCatalogEntry['highResCodec'] = caps.highResCodecs.includes('lhdc')
    ? 'LHDC 5.0'
    : caps.highResCodecs.includes('ldac')
      ? 'LDAC'
      : undefined;
  return {
    ...entry,
    supportsPersonalAnc: caps.personalAnc,
    supportsParametricEq: caps.advancedEq,
    supportsDiracOpteo: caps.dirac !== null,
    supportsUltraBass: caps.ultraBass !== null,
    supportsSpatialAudio: caps.spatialModes.length > 0,
    supportsDualConnection: caps.dualConnection,
    supportsSmartDial: caps.smartDial,
    ...(highResCodec ? { highResCodec } : {}),
  };
}

export const DEVICE_CATALOG: DeviceCatalogEntry[] = CATALOG_BASE.map(withDerivedFlags);
