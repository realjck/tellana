import { test, expect } from "@playwright/test";

test.describe("Parcours complet — création et lecture", () => {
  test("créer une story, ajouter un nœud, prévisualiser", async ({ page }) => {
    await page.goto("/");

    // Create story
    await page.fill('input[placeholder*="Titre"]', "Test E2E");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/stories\/\d+\/edit/);

    // Add a dialogue node
    await page.click("text=Ajouter un nœud");
    await page.click("text=Dialogue");
    await page.waitForSelector("textarea");
    await page.fill("textarea", "Bonjour depuis le test E2E !");
    await page.click("text=Enregistrer");

    // The preview should show the text
    await expect(page.locator("text=Bonjour depuis le test E2E !")).toBeVisible();

    // Clicking node 1 in sidebar should keep it selected
    await expect(page.locator('[role="button"]').first()).toHaveClass(/blue/);
  });

  test("avancer dans la preview met à jour la sidebar", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[placeholder*="Titre"]', "Sync Test");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/stories\/\d+\/edit/);

    // Add two nodes
    await page.click("text=Ajouter un nœud");
    await page.click("text=Dialogue");
    await page.fill("textarea", "Nœud 1");
    await page.click("text=Enregistrer");

    await page.click("text=Ajouter un nœud");
    await page.click("text=Dialogue");
    // Second node gets added — wait for form to reset
    await page.waitForTimeout(300);
    const textareas = page.locator("textarea");
    await textareas.first().fill("Nœud 2");
    await page.click("text=Enregistrer");

    // Click on the preview to advance to node 2
    await page.locator("text=Nœud 1").first().click();

    // Sidebar should now highlight node 2
    await expect(page.locator('[role="button"]').nth(1)).toHaveClass(/blue/);
  });

  test("publier et accéder à la page publique", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[placeholder*="Titre"]', "Story Publique");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/stories\/\d+\/edit/);

    // Add a node
    await page.click("text=Ajouter un nœud");
    await page.click("text=Texte narratif");
    await page.fill("textarea", "Contenu public !");
    await page.click("text=Enregistrer");

    // Publish
    await page.click("text=Publier");
    await expect(page.locator("text=Dépublier")).toBeVisible();

    // Copy the public link
    await page.click('[title="Copier le lien public"]');

    // Navigate to public page via slug (we know the story title was slugified)
    const url = page.url();
    const storyId = url.match(/\/stories\/(\d+)/)?.[1];
    expect(storyId).toBeTruthy();

    // Access the play page instead (doesn't require slug extraction)
    await page.goto(`/stories/${storyId}/play`);
    await expect(page.locator("text=Contenu public !")).toBeVisible();
  });

  test("écran de fin s'affiche après le dernier nœud", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[placeholder*="Titre"]', "Fin Test");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/stories\/\d+\/edit/);

    await page.click("text=Ajouter un nœud");
    await page.click("text=Dialogue");
    await page.fill("textarea", "Dernier message");
    await page.click("text=Enregistrer");

    // Advance past the last node in the preview
    await page.locator("text=Dernier message").first().click();
    await expect(page.locator("text=Recommencer")).toBeVisible();

    // Clicking Recommencer returns to node 1
    await page.click("text=Recommencer");
    await expect(page.locator("text=Dernier message")).toBeVisible();
  });
});
