package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.CategoryView;
import top.pxczxn.xingyu.community.service.CreationSpaceCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/me/creation-space")
@RequiredArgsConstructor
public class CommunityCreationSpaceController {

    private final CreationSpaceCategoryService categoryService;

    @GetMapping("/categories")
    public List<CategoryView> listCategories() {
        return categoryService.listForOwner(CommunityAuthContext.requireUser());
    }

    @PostMapping("/categories")
    public CategoryView create(@RequestBody Map<String, String> body) {
        return categoryService.create(
                CommunityAuthContext.requireUser(),
                body.get("name"),
                body.get("slug"));
    }

    @PatchMapping("/categories/{categoryId}")
    public CategoryView update(@PathVariable String categoryId, @RequestBody Map<String, Object> body) {
        return categoryService.update(CommunityAuthContext.requireUser(), categoryId, body);
    }

    @DeleteMapping("/categories/{categoryId}")
    public ResponseEntity<Void> delete(@PathVariable String categoryId) {
        categoryService.delete(CommunityAuthContext.requireUser(), categoryId);
        return ResponseEntity.noContent().build();
    }
}
