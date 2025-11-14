# Additional Mock Recipe Inserts

```sql
BEGIN;

-- 1. Ingredients
INSERT INTO public.ingredients (id, name, description, created_at, updated_at) VALUES
  ('d6bbd9f1-9e30-4a4b-8a9b-7f5f6b37e21d', 'Yellow Onion', 'Sweet yellow onion, diced for sautés.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('e2e77950-3a70-4d55-b01b-5ef76e3fadc8', 'Fresh Ginger', 'Aromatic ginger root, finely grated.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('2d814f86-6e84-4c7b-95d0-2a2bc4b67512', 'Red Split Lentils', 'Quick-cooking red split lentils, rinsed.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('e078c1a8-2985-43b5-9ac8-3d6b1981f594', 'Full-Fat Coconut Milk', 'Creamy canned coconut milk, well shaken.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('c1b98949-3297-4662-92e5-6bf8360fcb8a', 'Crushed Tomatoes', 'Canned crushed tomatoes with basil.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('0d4558b6-bf0b-4630-8a1a-2565d1a9d6cb', 'Fresh Cilantro', 'Roughly chopped cilantro leaves and tender stems.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('f6732548-0fa0-497b-9cd8-fd6404f2f0c6', 'Harissa Paste', 'North African chili paste for heat and depth.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('52d9c9c2-a256-4d8d-b093-bfce49963cf0', 'Cooked Chickpeas', 'Tender chickpeas, drained and rinsed.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('4893a181-1fc6-4581-b865-e0d7b85c1e76', 'Large Eggs', 'Pasture-raised large eggs.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('b2e4ad4b-7777-44d1-8fbb-d6770478dc0b', 'Chia Seeds', 'Black chia seeds for overnight soaking.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('07c47f83-1df9-48f6-b7d4-0dbe5c7f3cf3', 'Unsweetened Almond Milk', 'Plain almond milk with no added sugar.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('c998f019-5c39-48f0-9069-3caa2e038fd4', 'Vanilla Extract', 'Pure vanilla extract.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('0d91e5a0-fa92-4abf-a21a-53e6962caa2f', 'Coconut Yogurt', 'Dairy-free coconut yogurt.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('4d4f17a9-0de3-4820-b9ce-5e345cfbf76a', 'Mixed Berries', 'Strawberry, blueberry, and raspberry blend.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('5ace6794-0aa9-4c4f-9ec3-6d064cd7f631', 'Toasted Sliced Almonds', 'Lightly toasted sliced almonds.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z'),
  ('4f328998-b227-4fff-8f5a-3afd0cb59dda', 'Fresh Mint Leaves', 'Thinly sliced mint leaves for garnish.', '2025-01-08T08:00:00Z', '2025-01-08T08:00:00Z');

-- 2. Recipes (Cookbook ID 20617432-1c0a-459c-909f-13a4bb04cdd9)
INSERT INTO public.recipes (id, cookbook_id, title, preparation_description, image_url, image_alt_text, prep_time_minutes, display_order, created_at, updated_at) VALUES
  (
    'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a',
    '20617432-1c0a-459c-909f-13a4bb04cdd9',
    'Coconut Ginger Lentil Stew',
    'Heat olive oil in a large Dutch oven over medium heat. Add diced yellow onion and cook until softened, about 5 minutes. Add minced garlic and grated fresh ginger, cooking for 1 minute until fragrant. Stir in ground cumin. Add rinsed red split lentils, crushed tomatoes with their juices, and vegetable broth. Bring to a boil, then reduce heat and simmer for 20-25 minutes until lentils are tender. Stir in full-fat coconut milk and continue simmering for 5 minutes. Remove from heat and add fresh lime juice. Fold in baby spinach until just wilted. Season with salt and pepper. Serve hot, garnished with fresh chopped cilantro.',
    'https://example.com/images/coconut-ginger-lentil-stew.jpg',
    'Bowl of coconut ginger lentil stew topped with cilantro and lime wedges.',
    40,
    40,
    '2025-01-08T08:10:00Z',
    '2025-01-08T08:10:00Z'
  ),
  (
    '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a',
    '20617432-1c0a-459c-909f-13a4bb04cdd9',
    'One-Pan Harissa Chickpeas with Eggs',
    'Preheat oven to 375°F. Heat olive oil in a large oven-safe skillet over medium heat. Add sliced yellow onion and cook until translucent, about 5 minutes. Add minced garlic, harissa paste, smoked paprika, and ground cumin. Cook for 1 minute until fragrant. Add drained and rinsed chickpeas, crushed tomatoes, and vegetable broth. Simmer for 10 minutes until sauce thickens slightly. Stir in baby spinach until wilted. Create 4 small wells in the sauce and crack an egg into each. Transfer skillet to oven and bake for 8-10 minutes until egg whites are set but yolks are still runny. Remove from oven and scatter crumbled feta and fresh parsley over the top. Serve immediately with crusty bread.',
    'https://example.com/images/one-pan-harissa-chickpeas-eggs.jpg',
    'Skillet of harissa chickpeas with baked eggs and feta crumbles.',
    35,
    50,
    '2025-01-08T08:12:00Z',
    '2025-01-08T08:12:00Z'
  ),
  (
    'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa',
    '20617432-1c0a-459c-909f-13a4bb04cdd9',
    'Overnight Chia Berry Parfait',
    'Divide chia seeds evenly among four 8-ounce jars. In a medium bowl, whisk together unsweetened almond milk, maple syrup, and vanilla extract until combined. Pour the mixture over chia seeds in each jar, dividing equally. Whisk each jar vigorously for 30 seconds to prevent clumping. Cover and refrigerate for at least 4 hours or overnight until chia pudding has set. When ready to serve, layer coconut yogurt over the set chia pudding in each jar. Top with mixed berries (macerated with 1 tbsp maple syrup if desired). Sprinkle with toasted sliced almonds and garnish with fresh mint leaves. Serve chilled.',
    'https://example.com/images/overnight-chia-berry-parfait.jpg',
    'Glass jar of chia berry parfait topped with berries and mint.',
    15,
    60,
    '2025-01-08T08:15:00Z',
    '2025-01-08T08:15:00Z'
  );

-- 3. Recipe Ingredients
INSERT INTO public.recipe_ingredients (id, recipe_id, display_order, ingredient_id, name, quantity, notes, created_at, updated_at) VALUES
  ('bf9ef1c4-3f02-4f5a-828d-7736ed91c2c0', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 0, 'e7a43518-821f-4130-bdd2-f3f9e9a0f0ea', 'Extra virgin olive oil', '2 tbsp', 'Warm over medium heat in a Dutch oven.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('c2b2b3a2-34bb-4b7f-8b0e-f22d513d8c8c', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 1, 'd6bbd9f1-9e30-4a4b-8a9b-7f5f6b37e21d', 'Yellow onion, diced', '1 large', NULL, '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('1d7f3f58-0a77-43f9-96b8-6a7d6a0b1d40', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 2, '7a5f1c15-32e6-4b32-92d3-2c932a3be0d2', 'Garlic cloves, minced', '3', NULL, '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('5ea048d6-31b4-4559-b754-9d8fcb35c50c', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 3, 'e2e77950-3a70-4d55-b01b-5ef76e3fadc8', 'Fresh ginger, grated', '1 tbsp', 'Use microplane for paste-like texture.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('54b397d3-c8a8-49a2-9545-4f01e9a6d3de', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 4, '6c3a2c0a-327b-4a26-9bc1-7a359b5bff1d', 'Ground cumin', '1 tsp', NULL, '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('3f2b0c09-3298-4e41-8242-b8d1f75a5d8a', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 5, '2d814f86-6e84-4c7b-95d0-2a2bc4b67512', 'Red split lentils', '1 1/2 cups', 'Rinse until water runs clear.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('7d9c4538-56e1-407d-90d2-33c39f70c2b9', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 6, 'c1b98949-3297-4662-92e5-6bf8360fcb8a', 'Crushed tomatoes', '1 (28 oz) can', 'Include juices.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('97e6e2ad-a6ec-4cf9-8d31-9658c1105ad0', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 7, '4774f3f1-db5f-4f18-9c2b-2bdee315bacc', 'Vegetable broth', '4 cups', 'Low-sodium preferred.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('b7c5b568-dfa7-4905-950d-9c93b0d7d3d9', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 8, 'e078c1a8-2985-43b5-9ac8-3d6b1981f594', 'Full-fat coconut milk', '1 (13.5 oz) can', 'Stir in during final simmer.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('3b3e4d13-0f24-4b38-8cc1-1d6b4524da6f', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 9, '455b5e52-b482-4fb1-b9cd-2d2a3d8280c5', 'Fresh lime juice', '2 tbsp', 'Add off heat for brightness.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('8f97a1c9-de5b-4e2f-9889-3ebc1f09d3df', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 10, '8b1bb0eb-a0be-4904-92cf-5c44b36a14b2', 'Baby spinach', '4 cups', 'Fold in to wilt just before serving.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),
  ('5e4a146f-7a54-4cd0-9a2a-484d8d6dbd8b', 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', 11, '0d4558b6-bf0b-4630-8a1a-2565d1a9d6cb', 'Fresh cilantro, chopped', '1/2 cup', 'Reserve some for garnish.', '2025-01-08T09:00:00Z', '2025-01-08T09:00:00Z'),

  ('1c2a4d65-69b5-4c70-a2a3-3d90a8fbd381', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 0, 'e7a43518-821f-4130-bdd2-f3f9e9a0f0ea', 'Extra virgin olive oil', '3 tbsp', 'Heat in oven-safe skillet.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('77be8a93-0911-45fb-83ae-1e34bdeb18bb', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 1, 'd6bbd9f1-9e30-4a4b-8a9b-7f5f6b37e21d', 'Yellow onion, sliced', '1 medium', 'Cook until translucent.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('4a8b77f9-154d-469a-94bc-f630e2ea098b', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 2, '7a5f1c15-32e6-4b32-92d3-2c932a3be0d2', 'Garlic cloves, minced', '4', NULL, '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('72727117-72ca-4ed4-9fbe-be9703ca20e1', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 3, 'f6732548-0fa0-497b-9cd8-fd6404f2f0c6', 'Harissa paste', '3 tbsp', 'Bloom briefly with aromatics.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('1e45ef95-5800-4d51-8f38-7f022c8fa1b3', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 4, '5a7c9fde-e9e2-4ad0-8ab3-1d80f048393f', 'Smoked paprika', '1 tsp', NULL, '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('feaba395-6982-452a-9967-fb92ce40938e', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 5, '6c3a2c0a-327b-4a26-9bc1-7a359b5bff1d', 'Ground cumin', '1 tsp', NULL, '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('df50a5ea-b38d-4a3f-85ed-5c7a6ec9a7e9', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 6, '52d9c9c2-a256-4d8d-b093-bfce49963cf0', 'Cooked chickpeas', '2 (15 oz) cans', 'Drain and rinse well.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('a8c6fe87-47f8-4f1a-a79b-8f6d6e2d7d45', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 7, 'c1b98949-3297-4662-92e5-6bf8360fcb8a', 'Crushed tomatoes', '1 (14 oz) can', NULL, '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('b33d3f9b-4f41-4f3d-b4f5-f1078e9d9ed9', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 8, '4774f3f1-db5f-4f18-9c2b-2bdee315bacc', 'Vegetable broth', '1 cup', 'Helps form poaching sauce.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('208dbbca-cc56-4dda-b985-f608d89f508c', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 9, '4893a181-1fc6-4581-b865-e0d7b85c1e76', 'Large eggs', '4', 'Crack directly into simmering sauce.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('916c7bfa-f76e-4c83-9f88-f0d5857a1a7d', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 10, '8b1bb0eb-a0be-4904-92cf-5c44b36a14b2', 'Baby spinach', '3 cups', 'Stir in to wilt before serving.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('f83e09b1-8b81-4dbf-8faf-932d303e25ba', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 11, 'cfbdfb3e-88d9-4a91-9f39-35d8aacbb44f', 'Crumbled feta', '1/2 cup', 'Scatter over just before serving.', '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),
  ('8a6869fd-8a90-4ec4-bbe3-a905bb77eb32', '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 12, 'ee571596-72ae-4f14-9cb0-6923d79ae6d7', 'Fresh parsley, chopped', '1/4 cup', NULL, '2025-01-08T09:05:00Z', '2025-01-08T09:05:00Z'),

  ('04bfcdd1-6db1-4bf5-8cb8-a24f6d6b06c6', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 0, 'b2e4ad4b-7777-44d1-8fbb-d6770478dc0b', 'Chia seeds', '1/2 cup', 'Divide between four jars.', '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z'),
  ('1f4c2b4b-5410-4fa8-8f62-3ea364ab5393', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 1, '07c47f83-1df9-48f6-b7d4-0dbe5c7f3cf3', 'Unsweetened almond milk', '2 cups', 'Whisk with chia until evenly dispersed.', '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z'),
  ('21a2ebe5-392e-4b84-b83f-d8c2c641c96d', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 2, '6e6ba7fa-7136-4f03-86c9-52bfb41f29b4', 'Maple syrup', '3 tbsp', 'Adjust sweetness to taste.', '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z'),
  ('9f50cad4-20b6-4d46-89da-59310c131255', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 3, 'c998f019-5c39-48f0-9069-3caa2e038fd4', 'Vanilla extract', '1 tsp', NULL, '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z'),
  ('65f25f74-abbe-4e95-a9b1-be4808739bee', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 4, '0d91e5a0-fa92-4abf-a21a-53e6962caa2f', 'Coconut yogurt', '2 cups', 'Layer over set chia pudding.', '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z'),
  ('f5eab4e7-833d-4566-9a85-6e3c2ac9c11d', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 5, '4d4f17a9-0de3-4820-b9ce-5e345cfbf76a', 'Mixed berries', '3 cups', 'Macerate with 1 tbsp maple syrup if desired.', '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z'),
  ('eaf7a60f-3b82-4d34-8438-35d3c82fdfc2', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 6, '5ace6794-0aa9-4c4f-9ec3-6d064cd7f631', 'Toasted sliced almonds', '1/2 cup', 'Sprinkle just before serving.', '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z'),
  ('616a9d12-aa81-4d53-9a75-28d6b86b21c4', 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 7, '4f328998-b227-4fff-8f5a-3afd0cb59dda', 'Fresh mint leaves, sliced', '2 tbsp', NULL, '2025-01-08T09:10:00Z', '2025-01-08T09:10:00Z');

-- 4. Recipe Tags
INSERT INTO public.recipe_tags (recipe_id, tag_id, created_at) VALUES
  ('c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', '94347a14-2627-4fc3-81c4-939f249011c7', '2025-01-08T09:20:00Z'),
  ('c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', '02ec2016-1335-4776-bc7a-560e8c0a740d', '2025-01-08T09:20:00Z'),
  ('c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', '1c550731-be1b-46a9-a6ab-31c9cf30dcc7', '2025-01-08T09:20:00Z'),
  ('c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a', '391a0eb2-d83f-4835-9f1e-63f624af0fc8', '2025-01-08T09:20:00Z'),
  ('0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', '1fb90258-500a-4990-af48-70d15777577e', '2025-01-08T09:20:00Z'),
  ('0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', 'fe09f5fc-f9c2-40fc-9b90-94bd1ebe4b72', '2025-01-08T09:20:00Z'),
  ('0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a', '1c550731-be1b-46a9-a6ab-31c9cf30dcc7', '2025-01-08T09:20:00Z'),
  ('f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', '34d5b988-a6c5-447e-9ae5-071f43e4d999', '2025-01-08T09:20:00Z'),
  ('f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', 'db36476d-9601-4f01-9916-ccd2adaa6c2b', '2025-01-08T09:20:00Z'),
  ('f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', '3561758e-1a62-4d25-86a4-3d7d4545910b', '2025-01-08T09:20:00Z'),
  ('f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa', '02ec2016-1335-4776-bc7a-560e8c0a740d', '2025-01-08T09:20:00Z');

COMMIT;
```

