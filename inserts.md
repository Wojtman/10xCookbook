# Mock Recipe Inserts

```sql
BEGIN;

-- 1. Ingredients
INSERT INTO public.ingredients (id, name, description, created_at, updated_at) VALUES
  ('5a7c9fde-e9e2-4ad0-8ab3-1d80f048393f', 'Smoked Paprika', 'Hungarian-style smoked paprika for depth.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('3333c1f2-45a8-4ba7-a958-7e9cfcc9a2b3', 'Chipotle Peppers in Adobo', 'Smoky chipotle peppers packed in adobo sauce.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('60b5d20c-0d31-4b57-b8f2-03d32a7ecece', 'Cooked Black Beans', 'Slow-simmered black beans, drained and rinsed.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('4774f3f1-db5f-4f18-9c2b-2bdee315bacc', 'Vegetable Broth', 'Low-sodium vegetable broth.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('0959e3d3-5f58-46dd-b1a0-ced36d4418b4', 'Red Onion', 'Finely diced red onion.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('e44a702d-4b0e-4be8-8f0a-b8353b61ddb3', 'Cauliflower Florets', 'Roasted bite-sized cauliflower florets.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('63bfabbd-c725-49b0-8055-63f71d318ef0', 'Tahini', 'Sesame seed tahini paste.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('9d5ab696-0d30-4d4b-b270-59e86cdc84e8', 'Lemon Zest', 'Freshly grated lemon zest.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('0ca6414a-683e-4114-8d92-18a6c3b25f2f', 'Orzo Pasta', 'Toasted orzo pasta, cooked al dente.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('e67bd2e5-9694-44cc-8e32-1d6a4d3b8b5c', 'Fresh Basil', 'Roughly chopped fresh basil leaves.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('6ec5fdf4-8675-4d79-9cd6-c5bb4ab9adb2', 'Cherry Tomatoes', 'Halved cherry tomatoes.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('361bb40e-7fda-4c8d-8b98-08de0b84f2af', 'Kalamata Olives', 'Pitted and sliced Kalamata olives.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('8b1bb0eb-a0be-4904-92cf-5c44b36a14b2', 'Baby Spinach', 'Fresh baby spinach leaves.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('7a5f1c15-32e6-4b32-92d3-2c932a3be0d2', 'Garlic Cloves', 'Fresh garlic cloves, minced.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('e7a43518-821f-4130-bdd2-f3f9e9a0f0ea', 'Extra Virgin Olive Oil', 'Cold-pressed extra virgin olive oil.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('6c3a2c0a-327b-4a26-9bc1-7a359b5bff1d', 'Ground Cumin', 'Freshly ground cumin.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('455b5e52-b482-4fb1-b9cd-2d2a3d8280c5', 'Fresh Lime Juice', 'Juice from freshly squeezed limes.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('d807768e-5e28-4f6e-9150-3f5ad7881e48', 'Roasted Chickpeas', 'Crispy roasted chickpeas for crunch.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('b2146c1a-7ad1-4a0a-9c0c-38183c0e5471', 'Cooked Quinoa', 'Fluffy cooked quinoa.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('6e6ba7fa-7136-4f03-86c9-52bfb41f29b4', 'Maple Syrup', 'Pure maple syrup for sweetness.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('ee571596-72ae-4f14-9cb0-6923d79ae6d7', 'Fresh Parsley', 'Chopped flat-leaf parsley.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('f5f27ddb-4f0d-4be9-8ff0-0938cf7d8731', 'Fresh Lemon Juice', 'Juice from freshly squeezed lemons.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('cfbdfb3e-88d9-4a91-9f39-35d8aacbb44f', 'Crumbled Feta', 'Creamy feta cheese, crumbled.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z'),
  ('bd559196-cd48-4f2d-af08-fc9baa620f50', 'Red Wine Vinegar', 'Tangy red wine vinegar.', '2025-01-05T12:00:00Z', '2025-01-05T12:00:00Z');

-- 2. Recipes (Cookbook ID 20617432-1c0a-459c-909f-13a4bb04cdd9)
INSERT INTO public.recipes (id, cookbook_id, title, preparation_description, image_url, image_alt_text, prep_time_minutes, display_order, created_at, updated_at) VALUES
  (
    '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d',
    '20617432-1c0a-459c-909f-13a4bb04cdd9',
    'Smoky Chipotle Black Bean Soup',
    'Heat olive oil in a large Dutch oven over medium heat. Add diced red onion and cook until translucent, about 5 minutes. Add minced garlic, chipotle peppers, smoked paprika, and ground cumin. Cook for 1 minute until fragrant. Add rinsed black beans and vegetable broth. Bring to a boil, then reduce heat and simmer for 20 minutes, partially mashing some beans with the back of a spoon. Remove from heat and stir in fresh lime juice. Fold in baby spinach until just wilted. Season with salt and pepper to taste. Serve hot, garnished with fresh cilantro.',
    'https://example.com/images/smoky-chipotle-black-bean-soup.jpg',
    'Bowl of smoky chipotle black bean soup topped with avocado and cilantro.',
    35,
    10,
    '2025-01-07T12:00:00Z',
    '2025-01-07T12:00:00Z'
  ),
  (
    'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b',
    '20617432-1c0a-459c-909f-13a4bb04cdd9',
    'Roasted Cauliflower Tahini Bowls',
    'Preheat oven to 425°F. Toss cauliflower florets with olive oil, smoked paprika, and ground cumin. Spread on a baking sheet and roast for 25-30 minutes until golden and tender. Meanwhile, prepare quinoa according to package directions and fluff with a fork. Whisk together tahini, lemon zest, fresh lemon juice, and maple syrup until smooth. Divide baby spinach among serving bowls as the base. Top with cooked quinoa, roasted cauliflower, halved cherry tomatoes, and roasted chickpeas. Drizzle with tahini dressing and garnish with fresh parsley. Serve immediately.',
    'https://example.com/images/roasted-cauliflower-tahini-bowls.jpg',
    'Meal prep bowls filled with roasted cauliflower, quinoa, and tahini sauce.',
    40,
    20,
    '2025-01-07T12:05:00Z',
    '2025-01-07T12:05:00Z'
  ),
  (
    '329f9b59-6535-42a2-9bac-54aac5aded75',
    '20617432-1c0a-459c-909f-13a4bb04cdd9',
    'Lemon Basil Orzo Salad',
    'Cook orzo pasta in salted boiling water until al dente. Drain and rinse with cold water to stop cooking. While orzo is still warm, fold in lemon zest and half of the olive oil. In a small bowl, whisk together remaining olive oil, fresh lemon juice, grated garlic, and red wine vinegar to make the dressing. In a large bowl, combine cooled orzo with halved cherry tomatoes, sliced Kalamata olives, roughly chopped baby spinach, and chiffonade fresh basil. Pour dressing over and toss gently. Fold in crumbled feta just before serving. Let stand 10 minutes for flavors to meld. Serve at room temperature.',
    'https://example.com/images/lemon-basil-orzo-salad.jpg',
    'Serving bowl of lemon basil orzo salad garnished with feta and herbs.',
    25,
    30,
    '2025-01-07T12:10:00Z',
    '2025-01-07T12:10:00Z'
  );

-- 3. Recipe Ingredients
INSERT INTO public.recipe_ingredients (id, recipe_id, display_order, ingredient_id, name, quantity, notes, created_at, updated_at) VALUES
  ('15d3da91-50b4-45db-bc68-a6fa955ba17f', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 0, 'e7a43518-821f-4130-bdd2-f3f9e9a0f0ea', 'Extra virgin olive oil', '2 tbsp', 'Warm over medium heat until shimmering.', '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('5be0fbb0-6662-496d-9d59-f8d61fb6b8c8', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 1, '0959e3d3-5f58-46dd-b1a0-ced36d4418b4', 'Red onion, diced', '1 medium', NULL, '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('be0ebfb5-64f3-4bb5-ab91-0b9acd1c45f2', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 2, '7a5f1c15-32e6-4b32-92d3-2c932a3be0d2', 'Garlic cloves, minced', '3', NULL, '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('4bc9b5fa-7329-499d-a61d-89171cdbc5d4', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 3, '3333c1f2-45a8-4ba7-a958-7e9cfcc9a2b3', 'Chipotle peppers in adobo, minced', '2 tbsp', 'Include some adobo sauce for heat.', '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('9a9f0d66-f4c6-4d5b-b6de-4a90f5a9e269', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 4, '5a7c9fde-e9e2-4ad0-8ab3-1d80f048393f', 'Smoked paprika', '1 tsp', NULL, '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('c91d3e34-30c0-4e5a-b74a-6d4f0df20593', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 5, '6c3a2c0a-327b-4a26-9bc1-7a359b5bff1d', 'Ground cumin', '1 tsp', NULL, '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('d3a71c4c-3d6d-4bda-a2fc-462fe0fb4914', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 6, '60b5d20c-0d31-4b57-b8f2-03d32a7ecece', 'Cooked black beans', '3 cups', 'Rinse until water runs clear.', '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('58e2d630-2981-4512-b40b-d04b0b7a4aea', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 7, '4774f3f1-db5f-4f18-9c2b-2bdee315bacc', 'Vegetable broth', '4 cups', 'Low-sodium preferred.', '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('bdfdaa90-d1d7-4d65-8c4e-146385b0c8d6', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 8, '455b5e52-b482-4fb1-b9cd-2d2a3d8280c5', 'Fresh lime juice', '2 tbsp', 'Stir in off heat.', '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),
  ('1f4858cc-f5bf-4820-83b0-0408f2f7e16f', '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', 9, '8b1bb0eb-a0be-4904-92cf-5c44b36a14b2', 'Baby spinach', '3 cups', 'Fold in until just wilted.', '2025-01-07T12:15:00Z', '2025-01-07T12:15:00Z'),

  ('8177ff52-2e3c-40fe-adad-e7655fa19d7d', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 0, 'e44a702d-4b0e-4be8-8f0a-b8353b61ddb3', 'Cauliflower florets', '1 large head', 'Cut into 1-inch florets.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('d9b4f1b7-5713-4e0d-afb8-b9f854603f42', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 1, 'e7a43518-821f-4130-bdd2-f3f9e9a0f0ea', 'Extra virgin olive oil', '3 tbsp', 'Toss with cauliflower before roasting.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('6bb15496-3695-48e5-88fa-c0aa95918e5b', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 2, '5a7c9fde-e9e2-4ad0-8ab3-1d80f048393f', 'Smoked paprika', '2 tsp', NULL, '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('ad277024-7ba5-440d-9a26-88682ce67772', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 3, '6c3a2c0a-327b-4a26-9bc1-7a359b5bff1d', 'Ground cumin', '1 tsp', NULL, '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('8b66f850-3549-4dea-9b3b-0742079e2823', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 4, '63bfabbd-c725-49b0-8055-63f71d318ef0', 'Tahini', '1/3 cup', 'Whisk with lemon juice and maple syrup.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('d8f2eb76-2c6c-4e0f-8135-67fb2cd6580a', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 5, '9d5ab696-0d30-4d4b-b270-59e86cdc84e8', 'Lemon zest', '1 tsp', NULL, '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('bc9bb13c-73ef-42f0-9e3c-45b2d2936a9d', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 6, 'f5f27ddb-4f0d-4be9-8ff0-0938cf7d8731', 'Fresh lemon juice', '3 tbsp', NULL, '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('a7072ee0-89f7-4499-8916-8d7ab4ff4db3', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 7, '6e6ba7fa-7136-4f03-86c9-52bfb41f29b4', 'Maple syrup', '1 tbsp', 'Balances the tahini dressing.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('1cfca51d-13ca-4c5a-a69d-6cff7b3c6d61', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 8, 'b2146c1a-7ad1-4a0a-9c0c-38183c0e5471', 'Cooked quinoa', '4 cups', 'Fluff with a fork before assembly.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('0dbcf67a-c3cb-4f17-9d18-2762793cf973', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 9, 'd807768e-5e28-4f6e-9150-3f5ad7881e48', 'Roasted chickpeas', '1 1/2 cups', 'Add just before serving for crunch.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('3a4a34b5-da26-4d0e-b567-0f820cb6ef11', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 10, '8b1bb0eb-a0be-4904-92cf-5c44b36a14b2', 'Baby spinach', '4 cups', 'Divide among bowls as the base greens.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('58d7f4d7-7268-4e59-8d1d-f5e52857a134', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 11, '6ec5fdf4-8675-4d79-9cd6-c5bb4ab9adb2', 'Cherry tomatoes, halved', '2 cups', NULL, '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),
  ('f8d92b66-2268-4de0-91c1-980d5c7d522d', 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', 12, 'ee571596-72ae-4f14-9cb0-6923d79ae6d7', 'Fresh parsley, chopped', '1/2 cup', 'Reserve some for garnish.', '2025-01-07T12:20:00Z', '2025-01-07T12:20:00Z'),

  ('8be890c3-6c31-49a8-b175-b410030189d7', '329f9b59-6535-42a2-9bac-54aac5aded75', 0, '0ca6414a-683e-4114-8d92-18a6c3b25f2f', 'Orzo pasta', '12 oz', 'Cook until al dente and rinse to stop cooking.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('7f2ea9bb-16d0-4c79-84cb-6fdf7566f70f', '329f9b59-6535-42a2-9bac-54aac5aded75', 1, 'e7a43518-821f-4130-bdd2-f3f9e9a0f0ea', 'Extra virgin olive oil', '1/4 cup', 'Use half to dress the orzo and half to finish.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('75906961-9b34-4567-8db4-80fac67f4ac3', '329f9b59-6535-42a2-9bac-54aac5aded75', 2, '9d5ab696-0d30-4d4b-b270-59e86cdc84e8', 'Lemon zest', '2 tsp', 'Fold through while the orzo is still warm.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('359f04cd-0d73-4adf-8e44-12add3ed8884', '329f9b59-6535-42a2-9bac-54aac5aded75', 3, 'f5f27ddb-4f0d-4be9-8ff0-0938cf7d8731', 'Fresh lemon juice', '1/4 cup', 'Whisk with olive oil to make the dressing.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('fc2c25c9-b367-4a5f-b7ae-ee7ef5585ee1', '329f9b59-6535-42a2-9bac-54aac5aded75', 4, 'e67bd2e5-9694-44cc-8e32-1d6a4d3b8b5c', 'Fresh basil, chiffonade', '1 cup', NULL, '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('f22182ac-797c-4941-9a26-3a7fb4f76058', '329f9b59-6535-42a2-9bac-54aac5aded75', 5, '6ec5fdf4-8675-4d79-9cd6-c5bb4ab9adb2', 'Cherry tomatoes, halved', '2 cups', 'Use mixed colors for contrast.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('3d104a21-c27b-4bbf-9b1d-279ee8f06ead', '329f9b59-6535-42a2-9bac-54aac5aded75', 6, '361bb40e-7fda-4c8d-8b98-08de0b84f2af', 'Kalamata olives, sliced', '1 cup', NULL, '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('7ec2d527-558e-4f62-a850-e9c652271967', '329f9b59-6535-42a2-9bac-54aac5aded75', 7, '8b1bb0eb-a0be-4904-92cf-5c44b36a14b2', 'Baby spinach', '4 cups', 'Roughly chop if leaves are large.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('f5a7f809-34ae-4f51-a36b-52ba6de2f632', '329f9b59-6535-42a2-9bac-54aac5aded75', 8, '7a5f1c15-32e6-4b32-92d3-2c932a3be0d2', 'Garlic cloves, grated', '2', 'Bloom in olive oil before tossing.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('1b5ac67e-4a98-4a2c-9052-3600929cdbe5', '329f9b59-6535-42a2-9bac-54aac5aded75', 9, 'cfbdfb3e-88d9-4a91-9f39-35d8aacbb44f', 'Crumbled feta', '1 cup', 'Fold in just before serving.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z'),
  ('8cc447fb-e3c6-4e96-92ab-72902f6cd0de', '329f9b59-6535-42a2-9bac-54aac5aded75', 10, 'bd559196-cd48-4f2d-af08-fc9baa620f50', 'Red wine vinegar', '1 tbsp', 'Adds backbone to the dressing.', '2025-01-07T12:25:00Z', '2025-01-07T12:25:00Z');

-- 4. Recipe Tags
INSERT INTO public.recipe_tags (recipe_id, tag_id, created_at) VALUES
  ('9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', '391a0eb2-d83f-4835-9f1e-63f624af0fc8', '2025-01-07T12:30:00Z'),
  ('9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', '94347a14-2627-4fc3-81c4-939f249011c7', '2025-01-07T12:30:00Z'),
  ('9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d', '02ec2016-1335-4776-bc7a-560e8c0a740d', '2025-01-07T12:30:00Z'),
  ('d4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', '94347a14-2627-4fc3-81c4-939f249011c7', '2025-01-07T12:30:00Z'),
  ('d4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', '02ec2016-1335-4776-bc7a-560e8c0a740d', '2025-01-07T12:30:00Z'),
  ('d4db70e1-584b-4b81-97a1-8bbf9c2f4a3b', '3561758e-1a62-4d25-86a4-3d7d4545910b', '2025-01-07T12:30:00Z'),
  ('329f9b59-6535-42a2-9bac-54aac5aded75', '1fb90258-500a-4990-af48-70d15777577e', '2025-01-07T12:30:00Z'),
  ('329f9b59-6535-42a2-9bac-54aac5aded75', '1c550731-be1b-46a9-a6ab-31c9cf30dcc7', '2025-01-07T12:30:00Z'),
  ('329f9b59-6535-42a2-9bac-54aac5aded75', '391a0eb2-d83f-4835-9f1e-63f624af0fc8', '2025-01-07T12:30:00Z');

COMMIT;
```

