# Ingredients Seed Data

## Meat & Protein

```sql
INSERT INTO ingredients (name, description) VALUES
  ('Chicken Breast', 'Boneless, skinless poultry meat'),
  ('Ground Beef', 'Minced beef for burgers and sauces'),
  ('Salmon Fillet', 'Fresh salmon fish fillet'),
  ('Bacon', 'Cured and smoked pork belly strips'),
  ('Ground Turkey', 'Lean poultry mince'),
  ('Pork Chops', 'Cut from pork loin or rib'),
  ('Chicken Thighs', 'Dark meat chicken pieces'),
  ('Beef Steak', 'Premium cut beef for grilling'),
  ('Ground Lamb', 'Minced lamb meat'),
  ('Turkey Breast', 'Lean poultry breast meat'),
  ('Shrimp', 'Crustacean seafood'),
  ('Cod Fillet', 'White fish fillet'),
  ('Duck Breast', 'Rich poultry meat'),
  ('Beef Ribs', 'Rib cuts from beef'),
  ('Italian Sausage', 'Seasoned pork sausage'),
  ('Anchovies', 'Small salt-cured fish'),
  ('Tuna Steak', 'Premium tuna fish cut'),
  ('Veal Cutlet', 'Thin cut young beef'),
  ('Ham', 'Cured pork hind leg'),
  ('Lobster Tail', 'Lobster tail meat');
ON CONFLICT (name) DO NOTHING;
```

## Vegetables

```sql
INSERT INTO ingredients (name, description) VALUES
  ('Broccoli', 'Green cruciferous vegetable florets'),
  ('Carrots', 'Root vegetable, sweet and crunchy'),
  ('Onion', 'Pungent bulb vegetable'),
  ('Garlic', 'Aromatic bulb cloves'),
  ('Bell Pepper', 'Sweet capsicum fruit, various colors'),
  ('Spinach', 'Dark leafy green vegetable'),
  ('Tomato', 'Red fruit vegetable'),
  ('Potatoes', 'Starchy root vegetable'),
  ('Celery', 'Crisp stalked vegetable'),
  ('Zucchini', 'Green summer squash'),
  ('Mushrooms', 'Fungi-based produce'),
  ('Green Beans', 'Long slender pod vegetable'),
  ('Peas', 'Small round legume vegetables'),
  ('Cucumber', 'Watery salad vegetable'),
  ('Lettuce', 'Leafy green salad base'),
  ('Kale', 'Hearty dark leafy green'),
  ('Cauliflower', 'White cruciferous florets'),
  ('Eggplant', 'Purple elongated vegetable'),
  ('Asparagus', 'Green tender spears'),
  ('Sweet Potato', 'Orange starchy root vegetable');
ON CONFLICT (name) DO NOTHING;
```

## Fruits

```sql
INSERT INTO ingredients (name, description) VALUES
  ('Lemon', 'Citrus fruit with acidic juice'),
  ('Banana', 'Tropical fruit, creamy and sweet'),
  ('Strawberry', 'Red berries with seeds'),
  ('Blueberry', 'Small dark purple berries'),
  ('Apple', 'Crisp round fruit'),
  ('Orange', 'Citrus fruit, sweet and juicy'),
  ('Lime', 'Small green citrus fruit'),
  ('Raspberry', 'Delicate red berries'),
  ('Blackberry', 'Dark purple berries'),
  ('Mango', 'Tropical stone fruit'),
  ('Pineapple', 'Tropical spiky fruit'),
  ('Peach', 'Soft fuzzy stone fruit'),
  ('Pear', 'Sweet elongated fruit'),
  ('Watermelon', 'Large watery melon'),
  ('Cantaloupe', 'Orange netted melon'),
  ('Grapes', 'Small round berries on vine'),
  ('Kiwi', 'Green tropical fruit with seeds'),
  ('Papaya', 'Tropical orange fruit'),
  ('Avocado', 'Creamy green fruit'),
  ('Coconut', 'Tropical nut with white flesh');
ON CONFLICT (name) DO NOTHING;
```

## Miscellaneous

```sql
INSERT INTO ingredients (name, description) VALUES
  ('Olive Oil', 'Oil extracted from olives'),
  ('Butter', 'Dairy fat for cooking and baking'),
  ('All-Purpose Flour', 'Versatile wheat flour'),
  ('Pasta', 'Dried wheat noodles'),
  ('Salt', 'Mineral seasoning'),
  ('Black Pepper', 'Ground pepper spice'),
  ('Sugar', 'Granulated sweetener'),
  ('Baking Powder', 'Leavening agent for baking'),
  ('Baking Soda', 'Alkaline leavening powder'),
  ('Vegetable Oil', 'Oil from plant sources'),
  ('Coconut Oil', 'Oil from coconut meat'),
  ('Vinegar', 'Acidic liquid condiment'),
  ('Honey', 'Natural liquid sweetener'),
  ('Vanilla Extract', 'Aromatic vanilla flavoring'),
  ('Cinnamon', 'Sweet spice powder'),
  ('Oregano', 'Dried Mediterranean herb'),
  ('Basil', 'Fresh or dried aromatic herb'),
  ('Rice', 'Grain staple'),
  ('Cornstarch', 'Thickening powder'),
  ('Milk', 'Dairy liquid');
ON CONFLICT (name) DO NOTHING;
```
