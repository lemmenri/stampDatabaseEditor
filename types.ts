export type Collection = {
  blocks: Block[];
  country: string;
};

export type Block = {
  metadata: BlockMetadata;
  stamps: Stamp[];
  startingStamp: string;
  nextBlockStartingStamp: string;
};

export type Stamp = {
  height: number;
  width: number;
  denomination: string;
  color: string;
  catalogNumber: string;
  nvphNumber: string;
  image: string;
  type: string;
};

export type BlockMetadata = {
  year: string;
  title: string;
  nrOfStamps: string;
};
