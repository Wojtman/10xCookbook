# Recipe Updates - Migration from description to preparation_description

This file contains UPDATE statements to migrate existing recipes from `description` to `preparation_description` with actual preparation instructions.

```sql
BEGIN;

-- Update recipes to use preparation_description with step-by-step preparation instructions

-- 1. Smoky Chipotle Black Bean Soup
UPDATE public.recipes
SET preparation_description = 'Heat olive oil in a large Dutch oven over medium heat. Add diced red onion and cook until translucent, about 5 minutes. Add minced garlic, chipotle peppers, smoked paprika, and ground cumin. Cook for 1 minute until fragrant. Add rinsed black beans and vegetable broth. Bring to a boil, then reduce heat and simmer for 20 minutes, partially mashing some beans with the back of a spoon. Remove from heat and stir in fresh lime juice. Fold in baby spinach until just wilted. Season with salt and pepper to taste. Serve hot, garnished with fresh cilantro.'
WHERE id = '9a7d2bf8-4fcb-4b2b-8c3c-4d0f9bd3261d';

-- 2. Roasted Cauliflower Tahini Bowls
UPDATE public.recipes
SET preparation_description = 'Preheat oven to 425°F. Toss cauliflower florets with olive oil, smoked paprika, and ground cumin. Spread on a baking sheet and roast for 25-30 minutes until golden and tender. Meanwhile, prepare quinoa according to package directions and fluff with a fork. Whisk together tahini, lemon zest, fresh lemon juice, and maple syrup until smooth. Divide baby spinach among serving bowls as the base. Top with cooked quinoa, roasted cauliflower, halved cherry tomatoes, and roasted chickpeas. Drizzle with tahini dressing and garnish with fresh parsley. Serve immediately.'
WHERE id = 'd4db70e1-584b-4b81-97a1-8bbf9c2f4a3b';

-- 3. Lemon Basil Orzo Salad
UPDATE public.recipes
SET preparation_description = 'Cook orzo pasta in salted boiling water until al dente. Drain and rinse with cold water to stop cooking. While orzo is still warm, fold in lemon zest and half of the olive oil. In a small bowl, whisk together remaining olive oil, fresh lemon juice, grated garlic, and red wine vinegar to make the dressing. In a large bowl, combine cooled orzo with halved cherry tomatoes, sliced Kalamata olives, roughly chopped baby spinach, and chiffonade fresh basil. Pour dressing over and toss gently. Fold in crumbled feta just before serving. Let stand 10 minutes for flavors to meld. Serve at room temperature.'
WHERE id = '329f9b59-6535-42a2-9bac-54aac5aded75';

-- 4. Coconut Ginger Lentil Stew
UPDATE public.recipes
SET preparation_description = 'Heat olive oil in a large Dutch oven over medium heat. Add diced yellow onion and cook until softened, about 5 minutes. Add minced garlic and grated fresh ginger, cooking for 1 minute until fragrant. Stir in ground cumin. Add rinsed red split lentils, crushed tomatoes with their juices, and vegetable broth. Bring to a boil, then reduce heat and simmer for 20-25 minutes until lentils are tender. Stir in full-fat coconut milk and continue simmering for 5 minutes. Remove from heat and add fresh lime juice. Fold in baby spinach until just wilted. Season with salt and pepper. Serve hot, garnished with fresh chopped cilantro.'
WHERE id = 'c8e8a2f5-4f3e-4d7e-9ddf-04f829f1ba3a';

-- 5. One-Pan Harissa Chickpeas with Eggs
UPDATE public.recipes
SET preparation_description = 'Preheat oven to 375°F. Heat olive oil in a large oven-safe skillet over medium heat. Add sliced yellow onion and cook until translucent, about 5 minutes. Add minced garlic, harissa paste, smoked paprika, and ground cumin. Cook for 1 minute until fragrant. Add drained and rinsed chickpeas, crushed tomatoes, and vegetable broth. Simmer for 10 minutes until sauce thickens slightly. Stir in baby spinach until wilted. Create 4 small wells in the sauce and crack an egg into each. Transfer skillet to oven and bake for 8-10 minutes until egg whites are set but yolks are still runny. Remove from oven and scatter crumbled feta and fresh parsley over the top. Serve immediately with crusty bread.'
WHERE id = '0f825e6c-6ed7-4f4f-8cd9-6bee9a9c7e2a';

-- 6. Overnight Chia Berry Parfait
UPDATE public.recipes
SET preparation_description = 'Divide chia seeds evenly among four 8-ounce jars. In a medium bowl, whisk together unsweetened almond milk, maple syrup, and vanilla extract until combined. Pour the mixture over chia seeds in each jar, dividing equally. Whisk each jar vigorously for 30 seconds to prevent clumping. Cover and refrigerate for at least 4 hours or overnight until chia pudding has set. When ready to serve, layer coconut yogurt over the set chia pudding in each jar. Top with mixed berries (macerated with 1 tbsp maple syrup if desired). Sprinkle with toasted sliced almonds and garnish with fresh mint leaves. Serve chilled.'
WHERE id = 'f0bf1e0a-6e4b-4ad8-9d3a-57258fd2a9aa';

COMMIT;
```

## Notes

- These UPDATE statements assume the migration `20251102000700_rename_description_to_preparation_description.sql` has already been run to rename the column.
- If you have existing recipes with the old `description` column, run the migration first, then use these UPDATE statements to populate the new `preparation_description` field with actual preparation instructions.
- The preparation descriptions include step-by-step instructions with specific temperatures, times, and techniques.
- All recipe IDs match those in `inserts.md` and `inserts_part2.md`.
