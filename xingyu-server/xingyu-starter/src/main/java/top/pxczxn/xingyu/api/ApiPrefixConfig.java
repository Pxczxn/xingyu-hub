package top.pxczxn.xingyu.api;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ApiPrefixConfig implements WebMvcConfigurer {

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix("/api/v1/admin", c ->
                c.isAnnotationPresent(RestController.class)
                        && c.getPackage().getName().startsWith("top.pxczxn.xingyu.admin"));
        configurer.addPathPrefix("/api/v1", c ->
                c.isAnnotationPresent(RestController.class)
                        && (c.getPackage().getName().startsWith("top.pxczxn.xingyu.web")
                        || c.getPackage().getName().startsWith("top.pxczxn.xingyu.api")));
    }
}
