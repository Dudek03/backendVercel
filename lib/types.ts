export type ProductType = 'cpu' | 'gpu' | 'ram' | 'disk';

export interface Product {
  id: number;
  code: string;
  name: string;
  type: ProductType;
  price: number;
  amount: number;
  description: string;
  date: string;
  image: string;
}
